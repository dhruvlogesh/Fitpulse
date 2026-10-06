# FitPulse - Workout & Progress Tracking Platform

## Run it
1. Start MongoDB locally (default port 27017).
2. In `backend/`:  `npm install`  then  `node server.js`
3. Open http://localhost:5000

## Default admin
On first start a default admin is created:
- User ID: `admin`
- Password: `admin123`  (change it in server.js before sharing the project)

## Roles
- Member: log workouts, mark them done, track weight, rate workouts
- Coach:  review assigned workouts, update status, leave remarks
- Admin:  view members/coaches/workouts, assign coaches, see reports

Members and coaches register themselves; the admin account is created automatically.
