# Profile Feature Implementation Plan

Detailed plan for implementing the user profile feature, including profile picture support, metadata updates, and security enhancements.

---

## Phase 1: Schema & API Contract Updates

### 1. Backend Schema Enhancements
- **User Service (`apps/user-service/prisma/schema.prisma`)**:
    - Add `phoneNumber` (String?) and `countryCode` (String?) to the `UserProfile` model.
    - Add `status` (String?) for custom status messages.
- **Auth Service**: Use existing fields for email and password management.

### 2. API Contract Updates (`libs/openapi-specs`)
- Define `PATCH /users/me` for updating profile metadata (name, bio, phone, status).
- Define `POST /users/me/avatar` for multipart/form-data profile picture uploads.
- Define `POST /auth/change-email` and `POST /auth/verify-email-change` for the secure email update flow.
- Ensure all new fields are reflected in the shared TypeScript types.

### 3. Infrastructure & Environment Setup
- **Cloudinary Account**: Create a free account to obtain API credentials.
- **Environment Variables**: Add the following to `apps/user-service/.env`:
    - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name.
    - `CLOUDINARY_API_KEY`: Your API key.
    - `CLOUDINARY_API_SECRET`: Your API secret.
- **Dependencies**: Install `cloudinary` and `multer` (or `multer-storage-cloudinary`) in the `user-service`.

---

## Phase 2: Backend Logic Implementation

### 1. User Service
- **Profile Management**: Implement controllers and services to handle the new fields.
- **Avatar Upload (Cloudinary integration)**: 
    - Implement a `CloudinaryService` to handle image uploads and transformations.
    - Update the `avatarUrl` in the database with the secure URL from Cloudinary upon successful upload.
- **Event Synchronization**: Emit `user.profile.updated` events via Kafka to notify other services.

### 2. Auth Service
- **Email Verification Flow**: 
    - Implement logic to send a verification code to the *new* email address before updating it in the database.
- **Security Updates**: Ensure password updates follow the existing email verification flow.

---

## Phase 3: Frontend Implementation

### 1. Shared Components
- **Enhanced Avatar (`src/shared/components/ui/Avatar.tsx`)**:
    - **Logic**: If `avatarUrl` is present, render `<img>`; otherwise, render the first letter of `fullName` or `username`.
- **Navbar Update (`src/shared/components/Navbar.tsx`)**: 
    - Replace the manual avatar circle with the new `Avatar` component.
    - Wrap the avatar in a `Link` to the `/profile` route.

### 2. Profile Feature (`apps/frontend/src/features/profile`)
- **Profile Layout**: Create a settings-style layout for the profile page.
- **Edit Sections**:
    - **Basic Info**: Name and Bio fields.
    - **Avatar Upload**: A circular preview that opens a file picker on click.
    - **Contact Info**: Phone number input with a country code dropdown.
    - **Security**: 
        - Email display with an "Update" button that opens a verification modal.
        - Password display with a link to the existing password reset/update page.
- **Status & Preferences**: 
    - Add a "Current Status" input.

---

## Phase 4: Verification & Polish

### 1. Testing
- **Unit Tests**: Test the `Avatar` component for both image and fallback states.
- **Integration Tests**: Verify the profile update form submits correctly to the backend.
- **E2E Tests**: Use Playwright to test the full flow from uploading an avatar to seeing it updated in the Navbar.

### 2. UX Improvements
- Add loading states (spinners) for image uploads and form submissions.
- Use `Sonner` for success/error notifications.
- Ensure full responsiveness for mobile users.
