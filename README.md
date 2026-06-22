# Digital Life Lessons — Server

🔗 Live Site: [Digital Life Lessons](https://digital-life-lessons-moeen.vercel.app)

## Project Purpose

Digital Life Lessons Server is the backend API for the Digital Life Lessons full-stack platform. It manages authentication, users, lessons, favorites, comments, reports, admin moderation, premium access, Stripe payments, and MongoDB data operations.

The purpose of this server is to provide a secure, structured API where users can create and manage personal wisdom entries, browse public life lessons, interact with community content, and upgrade to Premium access through Stripe Checkout.

## Key Features

- Express.js REST API
- MongoDB Atlas database integration
- Better Auth authentication with email/password and Google login support
- Protected API routes using token/session verification
- Role-based authorization for users and admins
- Admin email and fixed admin password support
- Public lessons API with search, category filter, emotional tone filter, sorting, and pagination
- Combined Home API route for featured lessons, most saved lessons, and top contributors
- Lesson CRUD operations
- Owner/admin-only update and delete permissions
- Premium access-level logic for Free and Premium users
- Like/unlike functionality
- Save/remove favorites functionality
- Comment system
- Lesson report system
- Admin lesson moderation, featured lesson control, and review status
- Admin user management and analytics routes
- Stripe Checkout session creation for Premium upgrade
- Stripe webhook for updating user `isPremium` status after payment
- Environment-variable-based secure configuration
- Seed script for sample data

## Tech Stack
- Node.js
- Express.js
- MongoDB
- Better Auth
- Stripe
- CORS
- dotenv
- Morgan
- Nodemon

## NPM Packages Used

### Dependencies

```bash
@better-auth/mongo-adapter
better-auth
cors
dotenv
express
mongodb
morgan
stripe
```

