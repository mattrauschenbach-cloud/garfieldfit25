// src/routes.js
export const ROUTES = [
  { path: "/",               key: "home",            label: "Home",              auth: false },
  { path: "/login",          key: "login",           label: "Sign in",           auth: false },
  { path: "/diag",           key: "diag",            label: "Diagnostics",       auth: false },

  { path: "/members",        key: "members",         label: "Members",           auth: true },
  { path: "/monthly",        key: "monthly",         label: "Monthly",           auth: true },

  { path: "/monthly-admin",  key: "monthlyAdmin",    label: "Mentor",            mentor: true },
  { path: "/admin-standards",key: "adminStandards",  label: "Admin Standards",   mentor: true },

  { path: "/owner",          key: "owner",           label: "Owner",             owner: true },
  { path: "/owner/members",  key: "ownerMembers",    label: "Owner · Members",   owner: true },
]
