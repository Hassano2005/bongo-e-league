# Bongo eLeague Project - Architecture & Prompt Plan

**Purpose:** This document serves as the comprehensive "Master Prompt" and architectural blueprint used to conceptualize, design, and build the Bongo eLeague platform. It covers everything from the tech stack and database schema to the design aesthetics and complete user flows.

---

## 1. Project Overview
**Name:** Bongo eLeague
**Description:** A full-stack, premium e-sports tournament management platform specifically built for eFootball players in Tanzania. It handles user authentication, tournament registrations (via M-Pesa/cellular networks), 1v1 match scheduling, result screenshot verification, and automated leaderboards.

## 2. Technology Stack
- **Frontend:** Pure HTML5, CSS3 (Vanilla), and Vanilla JavaScript (No React/Vue).
- **Backend:** Node.js with Express.js.
- **Database:** SQLite (embedded `league.db`).
- **File Uploads:** Multer (for saving match result screenshots to local disk).
- **Authentication:** JSON Web Tokens (JWT) and Bcrypt (for password hashing).
- **Icons & Fonts:** FontAwesome 6, Google Fonts ('Orbitron' & 'Roboto').

## 3. Design Aesthetics & UI Identity
The success of this platform relies heavily on its **"WOW" factor**. It is not a basic MVP; it is a premium gaming platform.
- **Color Palette:** Deep space darks (`#030509`), electric cyan glow (`#00d2ff`), and magenta/pink accents (`#ff007f`).
- **Glassmorphism:** Elements use translucent backgrounds `rgba(8, 12, 20, 0.85)` with heavy backdrop blurs `backdrop-filter: blur(24px)`.
- **Gradients & Glows:** Extensive use of `linear-gradient` text masking and CSS box-shadow glow effects (`box-shadow: 0 0 35px rgba(0, 210, 255, 0.15)`).
- **Animations:** Subtle floating elements (`fadeInUp`), interactive hover states (scaling and glow intensification), and custom pulse dots for "Live" status badges.
- **Responsive Layouts:** CSS Grid and Flexbox to ensure perfect functionality across mobile and desktop.

## 4. Database Schema Structure
The platform is powered by an interconnected SQLite relational database (`backend/db.js`):

1. **`users`**: Manages authentication. `(id, username, phone, password_hash, role ['player' or 'admin'], created_at)`.
2. **`tournaments`**: Core event table. `(id, name, status ['upcoming', 'live', 'completed'], entry_fee, prize_pool)`.
3. **`participants`**: M:N relationship between users and tournaments. `(id, user_id, tournament_id, status, placement)`.
4. **`matches`**: Tracks 1v1 games. `(id, tournament_id, player1_id, player2_id, score1, score2, status)`.
5. **`payments`**: Handles entry fee tracking. `(id, user_id, tournament_id, phone_number, amount, status ['pending', 'approved', 'rejected'])`.
6. **`match_verifications`**: Crucial anti-cheat table. Players upload screenshots of their TV screens. `(id, tournament_id, submitted_by, opponent_id, my_score, opponent_score, screenshot_url, status)`.

## 5. Core Workflows & Logic

### Flow A: Joining a Tournament
1. User logs in, visits the Dashboard, and clicks "Join" on an upcoming tournament.
2. A payment modal prompts the user to send money via M-Pesa/Tigo/Airtel to a specific admin number.
3. User enters the mobile number they paid from and submits.
4. A record goes into `payments` as 'pending'.
5. **Admin Action:** Admin checks their real-world phone, confirms money received, and clicks "Approve Payment" in the Admin Panel.
6. The backend automatically inserts the user into the `participants` table. The player is now registered.

### Flow B: Playing & Verifying a Match
1. Players coordinate and play their 1v1 match offline/online on eFootball.
2. The winner (or either player) takes a smartphone photo of the final TV screen.
3. User goes to the Dashboard, clicks "Submit Result", selects their opponent, enters scores, and uploads the `.jpg`/`.png`.
4. The system uploads the image via Multer and creates a 'pending' `match_verifications` record.
5. **Admin Action:** Admin reviews the verification panel, looks at the photo to confirm the score.
6. If the admin clicks "Approve", the backend automatically calculates the winner and dynamically records the game permanently into the `matches` table.

## 6. Project Architecture (Files & Folders)
* **Frontend Pages:**
  * `index.html`: Stunning landing page with Login/Register toggle.
  * `home.html`: Main dashboard displaying stats, actionable widgets, and notifications.
  * `tournaments.html`: Grid exploring all tournaments.
  * `tournament_details.html`: Detailed view showing registered players, prize pool logic, and rules.
  * `admin.html`: Locked down route for database administration. Includes tabs for Payments, Verifications, Tournaments, and Players.
  * `profile.html`: Personal game history, placements, and joined tournaments.
  * `leaderboard.html`: Global ranking based on an F1-style point system (1st=100pts, 2nd=50pts, 3rd=25pts).
* **Backend:**
  * `server.js`: Node.js Express server housing all REST APIs (`/api/auth`, `/api/tournaments`, `/api/admin/...`, `/api/matches/...`).
  * `backend/db.js`: Initializes SQLite and builds tables on startup.
  * `backend/routes/auth.js`: Handles token generation and password verification.
* **Assets:**
  * `main.css`: Core design system using variables (CSS Custom Properties). Includes grids, modal animations, tables, and badge designs.
  * `main.js`: Global helper functions (like `showToast()` modal handling, and token interceptors).
  * `uploads/`: Directory to store the match verification screenshots.

## 7. Crucial Next-Level Features to Include
- **Single Page Feel (SPA):** Though using separate HTML files, the transitions, JWT usage in `localStorage`, and `fetch()` logic give it the speed of an SPA without page reloads on data submission.
- **Admin Cascade Deletion:** When an admin deletes a tournament or user, the backend must cleanly wipe reliant relational data (matches, verifications, payments) to prevent SQL constraint errors.
- **Dynamic Prize Logic:** The highest earning tournaments must adjust their total prize pool dynamically based on "Winner-Takes-All" mechanics and free entry logic for runners-up.
