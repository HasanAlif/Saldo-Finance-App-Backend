# Saldo - Personal Finance Management API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)

**A production-ready, scalable RESTful API for comprehensive personal finance management**

[Features](#-key-features) | [Architecture](#-architecture) | [API Reference](#-api-endpoints) | [Getting Started](#-getting-started)

</div>

---

## Overview

**Saldo** is a feature-rich backend system designed to help users take control of their finances. Built with modern technologies and best practices, it provides secure authentication, real-time budget tracking, intelligent notifications, and powerful analytics - all wrapped in a clean, maintainable codebase.

This project demonstrates proficiency in:
- **Backend Development** - RESTful API design, middleware patterns, error handling
- **Database Design** - MongoDB schema modeling, indexing, aggregation pipelines
- **Payment Integration** - Stripe checkout, webhooks, subscription management
- **Real-time Systems** - Push notifications with Firebase Cloud Messaging
- **DevOps Practices** - Cron job scheduling, graceful shutdown, environment configuration

---

## Key Features

### Authentication & Security
- **Multi-provider Authentication** - Email/password with bcrypt hashing + Google OAuth 2.0
- **JWT Token Management** - Secure tokens via Bearer header, HTTP-only cookies, or custom headers
- **OTP-based Password Recovery** - Email-delivered 6-digit codes with 15-minute expiry
- **Role-based Access Control** - User and Admin roles with middleware protection

### Financial Account Management
- **Multi-Account Support** - Track bank accounts, cash wallets, and credit cards separately
- **Real-time Balance Updates** - Automatic recalculation on every transaction
- **Transaction History** - Comprehensive income/spending records with category tagging
- **Recurring Transactions** - "Fill for Year" feature auto-generates monthly entries

### Intelligent Budget System
- **Flexible Budget Cycles** - Weekly and monthly budgets with customizable month start dates (1-28)
- **Category-based Tracking** - Monitor spending against budget limits per category
- **Smart Alerts** - Automated notifications at 50%, 80%, and 100% budget thresholds
- **Case-insensitive Matching** - Seamless category reconciliation across entries

### Financial Goals (Premium)
- **Goal Setting** - Create savings targets with custom icons and notes
- **Progress Tracking** - Visual percentage completion with accumulated amounts
- **Auto-completion** - Goals automatically marked complete when targets are reached

### Borrowing & Lending Tracker (Premium)
- **Debt Management** - Track money borrowed with lender details and due dates
- **Receivables Tracking** - Monitor money lent to others
- **Balance Integration** - Transactions automatically affect linked accounts
- **Payment Recording** - Log partial or full payments with automatic status updates

### Analytics & Reporting
- **Income vs Expenses** - Yearly breakdown with monthly granularity
- **Balance Trends** - Daily closing balance visualization with growth percentages
- **Category Analysis** - Spending distribution with percentage breakdowns
- **Comprehensive Reports** - Weekly and monthly summaries with transaction details

### Premium Subscription System
- **Stripe Integration** - Secure checkout flow with webhook verification
- **Multiple Plans** - Trial (7 days), Monthly (EUR 2.99), Annual (EUR 19.99), Lifetime (EUR 29.99)
- **Automatic Expiry** - Cron job handles plan downgrades at midnight UTC
- **Idempotent Processing** - Prevents duplicate charges through session tracking

### Push Notification Engine
- **Firebase Cloud Messaging** - Cross-platform push delivery
- **Timezone-aware Scheduling** - Daily reminders at 21:00 user's local time
- **Activity-based Targeting** - Different messages for active vs inactive users
- **Bulk Operations** - Efficient batched delivery (500 users/batch)

### Admin Dashboard APIs
- **User Analytics** - Growth charts, plan distribution, status breakdowns
- **Advanced Search** - Relevance-scored user search with pagination
- **Content Management** - Dynamic About Us, Privacy Policy, and Terms pages

---

## Architecture

```
src/
├── app/
│   ├── middlewares/          # Auth, validation, error handling, premium checks
│   ├── models/               # Mongoose schemas and TypeScript interfaces
│   ├── modules/              # Feature-based modular structure
│   │   ├── auth/             # Authentication & authorization
│   │   ├── user/             # User management & profile
│   │   ├── balance/          # Accounts, income, spending
│   │   ├── budget/           # Budget creation & tracking
│   │   ├── goals/            # Financial goals (premium)
│   │   ├── borrowed/         # Debt tracking (premium)
│   │   ├── lent/             # Lending tracking (premium)
│   │   ├── payment/          # Stripe integration
│   │   ├── notification/     # FCM push notifications
│   │   ├── analytics/        # Financial insights
│   │   ├── reports/          # Weekly/monthly reports
│   │   └── admin/            # Admin-only operations
│   └── routes/               # Centralized route registration
├── config/                   # Environment configuration
├── errors/                   # Custom error classes & handlers
├── helpers/                  # JWT, pagination, file upload utilities
├── interfaces/               # TypeScript type definitions
├── shared/                   # Reusable utilities (catchAsync, emailSender)
└── utils/                    # OTP generator, distance calculator, templates
```

### Design Patterns & Principles

| Pattern | Implementation |
|---------|----------------|
| **Modular Architecture** | Each feature is self-contained with controller, service, routes, validation |
| **Service Layer** | Business logic isolated from HTTP layer for testability |
| **Repository Pattern** | Mongoose models encapsulate database operations |
| **Middleware Chain** | Authentication, validation, and authorization as composable middlewares |
| **Error Boundary** | Global error handler with environment-aware responses |
| **Transaction Support** | MongoDB sessions ensure ACID compliance for multi-document operations |

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 5.x |
| **Framework** | Express.js 4.x |
| **Database** | MongoDB 8.x with Mongoose ODM |
| **Authentication** | JWT, bcrypt, Google OAuth 2.0 |
| **Payments** | Stripe Checkout + Webhooks |
| **Notifications** | Firebase Admin SDK (FCM) |
| **File Storage** | Cloudinary, DigitalOcean Spaces |
| **Validation** | Zod schema validation |
| **Email** | Nodemailer with SMTP |
| **Scheduling** | node-cron for background jobs |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/social-login` | Google OAuth login |
| POST | `/api/auth/forgot-password` | Request password reset OTP |
| POST | `/api/auth/verify-otp` | Verify reset OTP |
| POST | `/api/auth/reset-password` | Set new password |
| POST | `/api/auth/change-password` | Change password (authenticated) |
| GET | `/api/auth/profile` | Get current user profile |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Create new account |
| POST | `/api/users/profile-setup` | Set country, currency, language |
| PATCH | `/api/users/profile` | Update profile with image |
| GET | `/api/users` | List users (admin) |

### Balances & Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/balances/account` | Create new account |
| GET | `/api/balances/accounts` | Get all accounts with totals |
| POST | `/api/balances/:accountId/income` | Add income transaction |
| POST | `/api/balances/:accountId/spending` | Add spending transaction |
| GET | `/api/balances/by-date` | Get transactions by date |
| GET | `/api/balances/by-month` | Get monthly summary |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/budgets` | Create budget |
| GET | `/api/budgets?status=WEEKLY` | Get budgets with spending |
| PUT | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |
| POST | `/api/budgets/month-start-date` | Set custom month cycle |

### Goals (Premium)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/goals` | Create financial goal |
| GET | `/api/goals` | List all goals with progress |
| POST | `/api/goals/:id/progress` | Add progress amount |
| POST | `/api/goals/:id/complete` | Mark goal as complete |

### Payments & Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/checkout` | Create Stripe checkout session |
| POST | `/api/payments/webhook` | Stripe webhook handler |
| GET | `/api/payments/current-plan` | Get active subscription |
| POST | `/api/payments/trial` | Activate 7-day trial |

### Analytics & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/income-vs-expenses` | Yearly comparison |
| GET | `/api/analytics/balance-trend` | Daily balance history |
| GET | `/api/analytics/spending-by-category` | Category breakdown |
| GET | `/api/reports/weekly` | Weekly financial report |
| GET | `/api/reports/monthly` | Monthly financial report |

---

## Database Schema

### Core Collections

```
Users
├── Authentication (email, password, googleId, authProvider)
├── Profile (fullName, profilePicture, mobileNumber)
├── Localization (country, currency, language, timezone)
├── Premium (premiumPlan, premiumPlanExpiry, isEnjoyedTrial)
└── Settings (monthStartDate, fcmToken)

Balance (Accounts)
├── userId, name, amount, currency
├── accountType (SAVINGS, CHECKING, CREDIT, CASH)
└── creditLimit, lastUpdated

Income / Spending
├── userId, accountId, name, category
├── amount, currency, date, time
└── fillForAllYear (for recurring entries)

Budget
├── userId, category, budgetValue, currency
├── status (WEEKLY, MONTHLY)
└── notifiedThresholds[], thresholdPeriodStart

Goals
├── userId, name, icon, notes
├── targetAmount, accumulatedAmount
└── status (IN_PROGRESS, COMPLETED)

Borrowed / Lent
├── userId, accountId, name, amount
├── accumulatedAmount, status (PAID, UNPAID)
└── lender, debtDate, payoffDate
```

### Indexing Strategy
- Compound indexes on `{userId, date}` for transaction queries
- Sparse index on `googleId` for OAuth lookups
- Composite index on `{premiumPlan, premiumPlanExpiry}` for subscription checks
- Text indexes for user search functionality

---

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| `0 * * * *` | Daily Reminder | Sends push at 21:00 local time to inactive users |
| `0 9 * * 0` | Weekly Report | Sunday notifications for report availability |
| `0 9 * * *` | Monthly Report | Notifications on user's custom month-start date |
| `0 0 * * *` | Plan Expiry Check | Downgrades expired premium subscriptions |
| `0 0 * * *` | Fill for Year | Creates recurring transactions on cycle start |
| `*/5 * * * *` | User Status Update | Updates active/inactive status based on activity |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Stripe account (for payments)
- Firebase project (for push notifications)
- Cloudinary account (for file uploads)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/saldo-backend.git
cd saldo-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=mongodb://localhost:27017/saldo

# JWT
JWT_SECRET=your-secret-key
EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMENT_SUCCESS_URL=https://yourapp.com/success
PAYMENT_CANCEL_URL=https://yourapp.com/cancel

# Firebase (for FCM)
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Email
MAIL_HOST=smtp.gmail.com
MAIL_USER=your-email@gmail.com
MAIL_APP_PASS=your-app-password

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Security Highlights

- **Password Security** - bcrypt with configurable salt rounds
- **Token Validation** - JWT verification with user existence check
- **Input Sanitization** - Zod schemas validate all incoming data
- **SQL Injection Prevention** - MongoDB with parameterized queries
- **XSS Protection** - Proper output encoding and content-type headers
- **CORS Configuration** - Whitelist-based origin control
- **Webhook Security** - Stripe signature verification
- **Sensitive Data Protection** - Password and OTP fields excluded from queries

---

## Performance Optimizations

- **Aggregation Pipelines** - Complex queries computed in MongoDB, not Node.js
- **Parallel Queries** - `Promise.all()` for independent database operations
- **Lean Queries** - `.lean()` for read-only operations (3x faster)
- **Batch Processing** - Bulk notifications in 500-user chunks
- **Index Optimization** - Strategic compound indexes reduce query time
- **Memory Management** - Streaming file uploads via multer memory storage
- **Graceful Restart** - Automatic server recovery on uncaught exceptions

---

## Author

**Mehedi Hasan Alif** - Backend Developer

---

## License

ISC License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with precision and passion for clean code**

</div>
