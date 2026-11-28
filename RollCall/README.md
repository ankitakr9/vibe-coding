# 📋 RollCall – Attendance Management System

### Smart, Role-Based Attendance Management Platform

A web-based attendance management system designed to simplify attendance tracking, course administration, and academic performance monitoring through dedicated dashboards for administrators, faculty, and students.

**Built with React, TypeScript, Firebase, and Google AI Studio.**

---

## 🚀 Overview

**RollCall** is a web-based Attendance Management System that centralizes daily attendance recording, course management, and institutional directory administration into a single platform.

The application provides three role-based modules — **Administrator, Faculty, and Student** — with dedicated permissions and functionalities.

It uses Firebase Authentication for Google Sign-In and Cloud Firestore for data storage and synchronization. Its MVC-inspired architecture separates models, controllers, and views to keep application logic organized and maintainable.

## ✨ Key Features

### 👨‍💼 1. Administrator Module

- Manage student and faculty records with full CRUD operations.
- Create, update, and manage courses.
- Assign user roles: Admin, Faculty, and Student.
- View and manage attendance records.
- Lock and unlock attendance records.
- View individual student attendance transcripts.
- Load sample academic datasets.
- Export attendance reports in CSV format.

### 👩‍🏫 2. Faculty Module

- Record daily attendance for assigned courses.
- Mark students as Present, Late, Excused, or Absent.
- Add remarks to attendance records.
- Edit attendance entries while records are unlocked.
- Update class schedules.
- Monitor students with attendance below the 75% threshold.
- Export filtered attendance sheets as CSV files.

### 🎓 3. Student Module

- View personal attendance summaries.
- Check course-wise attendance percentages.
- Monitor academic standing based on the 75% attendance requirement.
- Access filterable attendance history.
- Track attendance records by date.

## 📊 Key Functionalities

### Live Analytics Dashboard

- Overall attendance percentage.
- Total attendance entries.
- Recent attendance session trends.
- Course-wise attendance summaries.
- Watchlist of students below 75% attendance.

### Batch Daily Roll Call

- Record attendance for an entire class.
- Mark all students present using a bulk action.
- Prevent duplicate daily attendance entries for the same student and course.
- Save multiple attendance updates in batches.

### Attendance History & CSV Export

- Search attendance records.
- Filter by course and attendance status.
- Apply date-range filters.
- Export filtered attendance data as CSV files.
- Sanitize exported CSV data.

### Security & Privacy

- Firebase Authentication with Google Sign-In.
- Role-based access control.
- Firestore security rules for database-level authorization.
- Document schema and server timestamp validation.
- Restricted storage of personal contact information through private subcollections.

## 🛠️ Technology Stack

| Category          | Technologies            |
| ----------------- | ----------------------- |
| Frontend          | React 19, TypeScript    |
| Build Tool        | Vite 8                  |
| Styling           | Tailwind CSS 4          |
| Authentication    | Firebase Authentication |
| Database          | Cloud Firestore         |
| AI Integration    | Google GenAI SDK        |
| Backend           | Node.js, Express.js     |
| Icons             | Lucide React            |
| Animations        | Motion                  |
| Development Tools | npm, ESLint, TypeScript |

## 🏗️ Application Architecture

RollCall follows an MVC-inspired architecture to organize application responsibilities.

- **Models:** Define data structures, schemas, and validation.
- **Controllers:** Handle CRUD operations and real-time data synchronization.
- **Views:** Provide dedicated interfaces for administrators, faculty, and students.

This structure improves code organization, maintainability, and separation of responsibilities.

## ⚙️ Run Locally

### Prerequisites

- Node.js
- npm
- Firebase project
- Google Gemini API key (if required by the application)

### Installation

**1. Clone the repository**

```bash
git clone <https://github.com/ankitakr9/vibe-coding/tree/main/RollCall>
```

**2. Navigate to the project directory**

```bash
cd RollCall
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create a `.env.local` file in the project root and configure the required environment variables.

```env
GEMINI_API_KEY=your_gemini_api_key
```

Make sure Firebase configuration is also set up according to your project's implementation.

**5. Start the development server**

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

## 📜 Available Scripts

| Command           | Description                                |
| ----------------- | ------------------------------------------ |
| `npm install`     | Install project dependencies               |
| `npm run dev`     | Start the development server               |
| `npm run build`   | Generate the production build              |
| `npm run preview` | Preview the production build               |
| `npm run lint`    | Run TypeScript type checking               |
| `npm run clean`   | Remove generated build files and server.js |

## 🔐 Security Considerations

- Keep API keys and private credentials out of version control.
- Add `.env.local` to `.gitignore`.
- Configure Firebase Authentication before using protected features.
- Apply appropriate Firestore security rules.
- Restrict access to personal information based on user roles.

## 🎯 Project Objective

RollCall aims to replace manual attendance management with a centralized digital solution.

By combining role-based access, real-time data synchronization, attendance analytics, and CSV reporting, the platform makes attendance management more efficient and transparent for administrators, faculty, and students.

---

### 💻 Built as part of my Vibe Coding Journey

**Exploring AI-assisted development and building practical applications with modern web technologies.**
