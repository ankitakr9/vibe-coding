# 📦 StowBase — Personal Inventory Management System

### Organize. Track. Manage. Stay in Control.

<p align="center">
  <a href="https://stowbase.ai.studio/">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-Visit_Website-2563EB?style=for-the-badge" alt="Live Demo">
  </a>
  <a href="https://github.com/ankitakr9/vibe-coding">
    <img src="https://img.shields.io/badge/GitHub-Source_Code-black?style=for-the-badge&logo=github" alt="GitHub">
  </a>
</p>

**StowBase** is a full-stack personal inventory management application designed to help individuals organize, monitor, and manage their personal belongings from a centralized dashboard.

Whether it's electronics, photography equipment, tools, outdoor gear, or household supplies, StowBase makes it easy to track quantities, storage locations, item conditions, estimated values, and borrowing activity.

The application uses a relational **PostgreSQL database** and supports real-time inventory synchronization, advanced filtering, secure authentication, and activity tracking.

---

## 🌐 Live Application

**Try StowBase:** [Visit Live Website](https://stowbase.ai.studio/)

Explore the application and experience its inventory management capabilities.

---

## ✨ Key Features

### 🔐 Authentication & User Management

- User registration, login, and logout.
- JWT-based authentication using HS256-signed tokens.
- Server-side token revocation during logout.
- Secure password hashing.
- Google Sign-In integration.
- Private user workspaces with account-level data isolation.

### 📊 Inventory Management

- Add, update, and delete inventory items.
- Track item names, SKU, brand, category, and serial numbers.
- Manage item quantities using instant + / − controls.
- Track item conditions and estimated unit values.
- Calculate total inventory value automatically.
- Track borrowed and lent-out items.

### 🚦 Smart Stock Management

- Automatic stock status calculation:
  - 🟢 In Stock
  - 🟡 Low Stock
  - 🔴 Out of Stock
  - 🔵 Lent Out
- Dedicated low-stock replenishment queue.
- Monitor inventory quantities and availability.

### 🔎 Advanced Search & Filtering

- Search across item names, SKU, brand, category, serial number, borrower, notes, and storage locations.
- Filter by category, stock status, condition, and storage space.
- Filter items using minimum and maximum unit values.
- Sort inventory by:
  - Name
  - Category
  - Quantity
  - Unit Value
  - Total Value
  - Last Updated

### 🏠 Storage Location Management

- Organize inventory by rooms, shelves, cabinets, and bins.
- Group items according to storage locations.
- View aggregated item quantities.
- Monitor estimated inventory valuations for each location.
- Track item movement and storage organization.

### ⚡ Real-Time Synchronization

- Server-Sent Events (SSE) for real-time updates.
- Synchronize inventory changes across active sessions.
- Receive updates without manually refreshing the application.

### 📜 Activity Tracking & Reports

- Chronological inventory activity log.
- Record stock changes and inventory movements.
- Monitor item quantity updates.
- Export filtered inventory records to CSV.

---

## 🛠️ Technology Stack

| Layer                   | Technologies             |
| ----------------------- | ------------------------ |
| Frontend                | React 19, TypeScript     |
| Styling                 | Tailwind CSS v4          |
| Icons                   | Lucide React             |
| Backend API             | Node.js, Express.js      |
| ORM                     | Drizzle ORM              |
| Database                | PostgreSQL               |
| Database Hosting        | Google Cloud SQL         |
| Authentication          | JWT, Google Sign-In      |
| Password Security       | Salted Password Hashing  |
| Real-Time Communication | Server-Sent Events (SSE) |
| Java Backend            | Java 21, Spring Boot 3   |
| Java Persistence        | Spring Data JPA          |
| Dynamic Queries         | JPA Specification        |
| Java Authentication     | JJWT, BCrypt             |
| Data Export             | CSV                      |

---

## 🏗️ Backend Architecture

StowBase includes two backend implementations.

### 1. Express.js Backend

The live application currently runs using an Express.js API server with Drizzle ORM and PostgreSQL.

Responsibilities include:

- Authentication and authorization.
- Inventory CRUD operations.
- Advanced server-side search and filtering.
- Storage location management.
- Inventory movement tracking.
- CSV exports.
- Real-time SSE updates.

### 2. Java Spring Boot Backend

A separate Java backend implementation is also included for standalone JVM deployment.

**Technologies:**

- Java 21
- Spring Boot 3
- Spring Data JPA
- JPA Specification-based dynamic queries
- JJWT for JWT authentication
- BCrypt for password hashing
- SseEmitter for real-time communication

The Java implementation explores enterprise-style backend development using the Spring ecosystem.

---

## 🗄️ Database Design

StowBase uses PostgreSQL with relational tables designed to maintain structured inventory data.

| Table               | Responsibility                                  |
| ------------------- | ----------------------------------------------- |
| users               | User account information                        |
| locations           | Storage locations                               |
| inventory_items     | Inventory item details                          |
| inventory_movements | Inventory quantity changes and movement history |

### Database Highlights

- Relational data modeling.
- Foreign-key relationships.
- Indexed columns for faster searching.
- User-level data isolation.
- Inventory movement tracking.
- Aggregated inventory valuations.

---

## ⚡ Core Application Capabilities

| Feature              | Implementation               |
| -------------------- | ---------------------------- |
| Authentication       | JWT + Google Sign-In         |
| Password Security    | Salted Password Hashing      |
| Inventory Operations | CRUD                         |
| Search               | Server-side indexed search   |
| Dynamic Filtering    | Multiple filter combinations |
| Sorting              | Multi-attribute sorting      |
| Stock Management     | Automatic stock status       |
| Real-Time Updates    | SSE                          |
| Storage Organization | Location-based grouping      |
| Activity Tracking    | Inventory movement history   |
| Data Export          | CSV                          |

---

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL
- Java 21 (for the Spring Boot backend)
- Maven (for the Java backend)

### Frontend & Express Backend

**1. Clone the repository**

```bash
git clone <your-repository-url>
```

**2. Navigate to the project directory**

```bash
cd stowbase
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Configure the required database, authentication, and Google Sign-In credentials.

**5. Start the application**

Use the development scripts defined in `package.json`.

### Java Spring Boot Backend

1. Ensure Java 21 and Maven are installed.
2. Configure the PostgreSQL database connection.
3. Configure JWT and Google authentication properties.
4. Build and run the application using its Maven configuration.

**Note:** Exact environment variable names and execution commands depend on the respective backend configuration files.

---

## 🔒 Security Considerations

- Password hashing instead of storing plaintext passwords.
- Signed JWT authentication tokens.
- Server-side logout revocation.
- User-specific inventory access.
- Account-level data isolation.
- Protected application operations.

Never commit database credentials, JWT secrets, Google OAuth credentials, or other sensitive environment variables to GitHub.

---

## 🎯 Learning Objectives

This project explores practical concepts in modern full-stack and enterprise application development:

- Full-stack application architecture.
- REST API development.
- PostgreSQL relational database design.
- ORM-based database operations.
- Authentication and authorization.
- Dynamic database queries.
- Real-time communication using SSE.
- Inventory and transaction management.
- React and TypeScript development.
- Java Spring Boot backend architecture.
- Data export and reporting.

---

## 👩‍💻 Developer

**Ankita Kumari**

Aspiring Java Full Stack Developer | Full-Stack Development | AI-Assisted Development Enthusiast

- GitHub: [@ankitakr9](https://github.com/ankitakr9)
- Project Collection: [Vibe Coding](https://github.com/ankitakr9/vibe-coding)

---

## ⭐ Support

If you find StowBase interesting, consider giving this repository a ⭐.

**StowBase — Your belongings, organized in one place.** 📦
