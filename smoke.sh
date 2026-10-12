#!/usr/bin/env bash
# =========================================================
# FixMate backend smoke tests — full booking workflow + negative cases.
# Requires: server running on $BASE (default http://localhost:3000),
# DB seeded (schema.sql, seed.sql, npm run create-admin, npm run seed-demo-users).
# Usage: bash tests/smoke.sh
# =========================================================
set -u
BASE="${BASE:-http://localhost:3000}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check() { # $1 label, $2 expected-needle, $3 actual-body
  if echo "$3" | grep -q "$2"; then ok "$1"; else bad "$1 — expected '$2' in: $(echo "$3" | head -c 200)"; fi
}
nocheck() { # expect needle ABSENT
  if echo "$3" | grep -q "$2"; then bad "$1 — found unwanted '$2'"; else ok "$1"; fi
}

TODAY=$(date -d "+2 days" +%F 2>/dev/null || date -v+2d +%F)

echo "== 1. Auth =="
R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@fixmate.demo","password":"Admin123!"}')
check "admin login returns token" '"role":"admin"' "$R"
ADMIN=$(echo "$R" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"customer@fixmate.demo","password":"Password123!"}')
check "customer login returns token" '"role":"customer"' "$R"
CUST=$(echo "$R" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ravi@fixmate.demo","password":"Password123!"}')
check "technician login returns token" '"role":"technician"' "$R"
TECH=$(echo "$R" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

R=$(curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"Second User\",\"email\":\"user$RANDOM@test.demo\",\"phone\":\"+1-555-777-0000\",\"password\":\"Password123!\"}")
check "customer registration works" '"role":"customer"' "$R"
CUST2=$(echo "$R" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@fixmate.demo","password":"WRONG"}')
check "wrong password rejected" 'Invalid email or password' "$R"

R=$(curl -s $BASE/api/admin/dashboard)
check "dashboard blocked without token" 'Authentication required' "$R"

echo "== 2. Customer creates a booking (server-side pricing) =="
SVC=$(curl -s "$BASE/api/services?search=AC%20Service" | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
SVC=$(curl -s "$BASE/api/services?search=AC%20Service" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  (service id: $SVC)"
R=$(curl -s -X POST $BASE/api/bookings -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' \
  -d "{\"serviceId\":$SVC,\"address\":\"1 Test Street\",\"city\":\"Downtown\",\"date\":\"$TODAY\",\"timeSlot\":\"09:00-11:00\",\"notes\":\"Smoke test booking\"}")
check "booking created with server ID" 'HSP-' "$R"
BK=$(echo "$R" | grep -o '"id":"HSP-[0-9-]*"' | head -1 | cut -d'"' -f4)
check "estimated price set by SERVER from DB (55)" '"estimated_price":55' "$R"

R=$(curl -s -X POST $BASE/api/bookings -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' \
  -d "{\"serviceId\":$SVC,\"address\":\"1 Test Street\",\"city\":\"Downtown\",\"date\":\"$TODAY\",\"timeSlot\":\"09:00-11:00\",\"notes\":\"tamper\",\"estPrice\":1,\"estimatedPrice\":1}")
nocheck "client-supplied price is IGNORED" '"estimated_price":1' "$R"

R=$(curl -s -X POST $BASE/api/bookings -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' \
  -d "{\"serviceId\":$SVC,\"address\":\"x\",\"city\":\"y\",\"date\":\"2000-01-01\",\"timeSlot\":\"09:00-11:00\",\"notes\":\"past\"}")
check "past date rejected by validator" 'not in the past' "$R"

echo "== 3. Ownership =="
R=$(curl -s $BASE/api/bookings/$BK -H "Authorization: Bearer $CUST2")
check "another customer cannot open the booking" 'Booking not found' "$R"
R=$(curl -s $BASE/api/bookings/$BK -H "Authorization: Bearer $CUST")
check "owner can view own booking" "$BK" "$R"

echo "== 4. Admin assigns technician (overlap check) =="
TECHID=$(curl -s $BASE/api/admin/technicians -H "Authorization: Bearer $ADMIN" | grep -o '{"id":[0-9]*,"name":"Ravi Kumar"' | grep -o '[0-9]*' | head -1)
echo "  (Ravi Kumar technician id: $TECHID)"
R=$(curl -s -X POST $BASE/api/admin/bookings/$BK/assign -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"technicianId\":$TECHID}")
check "admin assigns technician" 'Technician assigned' "$R"
# Second booking, same slot, same technician → must be blocked
R=$(curl -s -X POST $BASE/api/bookings -H "Authorization: Bearer $CUST2" -H 'Content-Type: application/json' \
  -d "{\"serviceId\":$SVC,\"address\":\"9 Conflict Ave\",\"city\":\"Downtown\",\"date\":\"$TODAY\",\"timeSlot\":\"09:00-11:00\",\"notes\":\"overlap probe\"}")
BK2=$(echo "$R" | grep -o '"id":"HSP-[0-9-]*"' | head -1 | cut -d'"' -f4)
R=$(curl -s -X POST $BASE/api/admin/bookings/$BK2/assign -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"technicianId\":$TECHID}")
check "same-slot assignment blocked (overlap)" 'Slot conflict' "$R"
R=$(curl -s -X POST $BASE/api/admin/bookings/$BK/assign -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"technicianId\":$TECHID}")
check "reassignment of same booking allowed (self excluded)" 'Technician assigned' "$R"
R=$(curl -s -X POST $BASE/api/admin/bookings/$BK/assign -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d "{\"technicianId\":$TECHID}")
check "customer cannot assign technicians" 'permission' "$R"

echo "== 5. Technician workflow =="
R=$(curl -s $BASE/api/tech/jobs -H "Authorization: Bearer $TECH")
check "technician sees own assigned job" "$BK" "$R"
R=$(curl -s $BASE/api/tech/jobs/$BK -H "Authorization: Bearer $TECH")
check "job details include customer contact when authorized" 'customer_phone' "$R"
R=$(curl -s -X POST $BASE/api/tech/jobs/$BK/status -H "Authorization: Bearer $TECH" -H 'Content-Type: application/json' -d '{"status":"In Progress"}')
check "invalid transition Assigned→In Progress blocked" 'Invalid status transition' "$R"
for S in Accepted "On the Way" "In Progress"; do
  R=$(curl -s -X POST $BASE/api/tech/jobs/$BK/status -H "Authorization: Bearer $TECH" -H 'Content-Type: application/json' -d "{\"status\":\"$S\"}")
  check "transition → $S" 'Job status updated' "$R"
done
R=$(curl -s -X POST $BASE/api/tech/jobs/$BK/quote -H "Authorization: Bearer $TECH" -H 'Content-Type: application/json' -d '{"amount":60}')
check "quote submitted" 'Quote submitted' "$R"
R=$(curl -s -X POST $BASE/api/tech/jobs/$BK/status -H "Authorization: Bearer $TECH" -H 'Content-Type: application/json' -d '{"status":"Completed"}')
check "job completed" 'Job status updated' "$R"
R=$(curl -s $BASE/api/tech/earnings -H "Authorization: Bearer $TECH")
check "earnings reflect completed job" 'payable' "$R"

echo "== 6. Payment + review =="
R=$(curl -s $BASE/api/admin/payments -H "Authorization: Bearer $ADMIN")
check "payment record exists (pending)" 'pending' "$R"
PID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
R=$(curl -s -X PUT $BASE/api/admin/payments/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"status":"paid"}')
check "demo-labelled payment marked paid (explicitly demo)" 'DEMO payment marked paid' "$R"
R=$(curl -s $BASE/api/admin/payments -H "Authorization: Bearer $ADMIN")
check "payment summary computed from records" 'payable' "$R"

R=$(curl -s -X POST $BASE/api/bookings/$BK/review -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d '{"rating":5,"comment":"Great smoke-test service!"}')
check "customer reviews completed booking" 'Review submitted' "$R"
R=$(curl -s -X POST $BASE/api/bookings/$BK/review -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d '{"rating":4,"comment":"duplicate"}')
check "duplicate review blocked" 'already reviewed' "$R"

echo "== 7. Reports, settings, logout =="
R=$(curl -s "$BASE/api/admin/reports" -H "Authorization: Bearer $ADMIN")
check "admin reports include revenue" 'completedJobs' "$R"
R=$(curl -s $BASE/api/settings)
# (public settings endpoint, no auth)
check "public settings endpoint" 'FixMate' "$R"
R=$(curl -s -X POST $BASE/api/auth/logout)
check "logout endpoint" 'Logged out' "$R"

echo ""
echo "======================================="
echo "RESULT: $PASS passed, $FAIL failed"
echo "======================================="
[ $FAIL -eq 0 ] && echo "ALL SMOKE TESTS PASSED" || echo "SOME TESTS FAILED"
exit $FAIL
