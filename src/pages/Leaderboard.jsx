rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    /* ========== Helper functions ========== */
    function isSignedIn() {
      return request.auth != null;
    }

    function myUid() {
      return request.auth.uid;
    }

    function myRole() {
      return isSignedIn()
        ? get(/databases/$(database)/documents/profiles/$(myUid())).data.role
        : null;
    }

    function isOwner() { return myRole() == 'owner'; }
    function isAdmin() { return myRole() == 'admin'; }
    function isMentor() { return myRole() == 'mentor'; }
    function isStaff() { return isOwner() || isAdmin() || isMentor(); }

    /* =====================================================
       PROFILES
       /profiles/{uid}
       - Read: any signed-in user (so members can see each other)
       - Write: user can edit themselves; owner can edit anyone
       ===================================================== */
    match /profiles/{uid} {
      allow read: if isSignedIn();

      allow create, update, delete: if isSignedIn() && (
        myUid() == uid || isOwner()
      );

      // Optional: basic shape/validation when writing profiles
      allow create, update: if isSignedIn() && (
        (request.resource.data.keys().hasOnly([
          'displayName', 'photoURL', 'tier', 'role',
          'createdAt', 'updatedAt', 'email'
        ])) || (request.resource.data.keys().hasAny([
          // allow partial merges too
          'displayName', 'photoURL', 'tier', 'role',
          'createdAt', 'updatedAt', 'email'
        ]))
      );
    }

    /* =====================================================
       CHECKOFFS (per profile)
       /profiles/{uid}/checkoffs/{standardId}
       - Read: any signed-in
       - Write: staff (mentor/admin/owner) only
       ===================================================== */
    match /profiles/{uid}/checkoffs/{standardId} {
      allow read: if isSignedIn();

      // staff controls checkoffs (members cannot)
      allow create, update, delete: if isSignedIn() && isStaff();

      // Optional field allowlist + lightweight type checks
      allow create, update: if isSignedIn() && isStaff()
        && request.resource.data.keys().hasOnly([
          'checked', 'checkedAt', 'checkedByUid', 'checkedByName',
          'notes', 'standardId', 'tier', 'category'
        ])
        && (request.resource.data.checked is bool)
        && (request.resource.data.standardId is string)
        && (request.resource.data.tier is string)
        && (request.resource.data.category is string);
    }

    /* =====================================================
       CHECKOFF HISTORY (audit)
       /profiles/{uid}/checkoffs/{standardId}/history/{eventId}
       - Read: any signed-in
       - Create: staff
       - Update: never
       - Delete: owner only
       ===================================================== */
    match /profiles/{uid}/checkoffs/{standardId}/history/{eventId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && isStaff();
      allow update: if false;
      allow delete: if isSignedIn() && isOwner();
    }

    /* =====================================================
       STANDARDS
       /standards/{id}
       - Read: any signed-in
       - Write: owner only (manage catalog of standards)
       -----------------------------------------------------
       RECORD subcollection (single doc "current")
       /standards/{id}/record/{recId}
       - Read: any signed-in
       - Write: owner or admin (NOT mentors)
       ===================================================== */
    match /standards/{id} {
      allow read: if isSignedIn();
      allow create, update, delete: if isSignedIn() && isOwner();

      match /record/{recId} {
        allow read: if isSignedIn();
        allow create, update, delete: if isSignedIn() && (isOwner() || isAdmin());

        // shape for record/current
        allow create, update: if isSignedIn() && (isOwner() || isAdmin())
          && request.resource.data.keys().hasOnly([
            'holderUid', 'holderName', 'value', 'unit',
            'notes', 'updatedAt', 'verifiedByUid', 'verifiedByName',
            'standardTitle'
          ])
          && (
            // value can be number or null (allow clearing by omitting or setting null)
            !(request.resource.data.keys().hasAny(['value'])) ||
            (request.resource.data.value is number)
          )
          && (
            !(request.resource.data.keys().hasAny(['unit'])) ||
            (request.resource.data.unit is string)
          );
      }
    }

    /* =====================================================
       WEEKLY CHALLENGES
       /weeklyChallenges/{weekId}
       - Read: any signed-in
       - Write: owner/admin manage the week document
       -----------------------------------------------------
       LOGS
       /weeklyChallenges/{weekId}/logs/{logId}
       - Read: any signed-in
       - Create: author must set uid == myUid()
       - Update/Delete: author OR staff
       ===================================================== */
    match /weeklyChallenges/{weekId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isSignedIn() && (isOwner() || isAdmin());

      match /logs/{logId} {
        allow read: if isSignedIn();

        allow create: if isSignedIn()
          && request.resource.data.uid == myUid();

        allow update, delete: if isSignedIn() && (
          isStaff() || resource.data.uid == myUid()
        );

        // light validation
        allow create, update: if request.resource.data.keys().hasOnly([
          'uid', 'displayName', 'value', 'note', 'createdAt', 'updatedAt'
        ])
        && (request.resource.data.value is number)
        && (
          !(request.resource.data.keys().hasAny(['note'])) ||
          (request.resource.data.note is string)
        );
      }
    }

    /* =====================================================
       MESSAGES / ANNOUNCEMENTS
       /messages/{id}
       - Read: any signed-in
       - Write: staff (mentor/admin/owner)
       ===================================================== */
    match /messages/{id} {
      allow read: if isSignedIn();
      allow create, update, delete: if isSignedIn() && isStaff();

      allow create, update: if request.resource.data.keys().hasOnly([
        'title', 'body', 'pinned', 'authorUid', 'authorName',
        'createdAt', 'updatedAt'
      ])
      && (request.resource.data.title is string)
      && (request.resource.data.body is string)
      && (
        !(request.resource.data.keys().hasAny(['pinned'])) ||
        (request.resource.data.pinned is bool)
      );
    }

    /* =====================================================
       SETTINGS (entry gate quote, records set, etc.)
       /settings/{id}  (ids like "entryGate", "records")
       - Read: any signed-in
       - Write: owner only
       ===================================================== */
    match /settings/{id} {
      allow read: if isSignedIn();
      allow create, update, delete: if isSignedIn() && isOwner();

      // common fields used by entryGate and records pages
      allow create, update: if request.resource.data.keys().hasOnly([
        // entryGate
        'quote',
        // records set
        'standardIds',

        // meta
        'updatedAt', 'updatedByUid', 'updatedByName'
      ])
      && (
        !(request.resource.data.keys().hasAny(['quote'])) ||
        (request.resource.data.quote is string)
      )
      && (
        !(request.resource.data.keys().hasAny(['standardIds'])) ||
        (request.resource.data.standardIds is list)
      );
    }

    /* ===== Default deny everything else ===== */
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
