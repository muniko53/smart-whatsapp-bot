# Dashboard map (frontend/src)

## Routes (App.js)

| Path | Page | Role |
|---|---|---|
| /login | pages/Login.js | public |
| /admin | pages/admin/Dashboard.js | admin |
| /admin/businesses, /admin/businesses/:id | pages/admin/Businesses.js, BusinessDetail.js | admin |
| /admin/orders, /admin/escalations | pages/admin/Orders.js, Escalations.js | admin |
| /dashboard | pages/business/Dashboard.js | business |
| /profile | pages/business/Profile.js | business |
| /conversations | pages/business/Conversations.js | business |
| /orders | pages/business/Orders.js | business |
| /customers | pages/business/Customers.js | business |
| /marketing | pages/business/Marketing.js | business |

## Shared

- components/Layout.js (sidebar shell), Sidebar.js (nav — update on new routes),
  StatCard.js (metric card), WebChatWidget.js (floating public chat → POST /api/webchat)
- context/AuthContext.js (login/logout, `wa_user` session)
- hooks/useIsMobile.js (mobile breakpoint)
- api.js — axios instance, see skill doc

## Backend endpoints used (base /api)

- POST /auth/login|register|refresh|logout, GET /business/stats, GET|PUT /business/profile,
  POST /business/upload-image, PUT /business/credentials, PUT /business/bot/toggle,
  GET /business/conversations[/:id/messages], GET|PUT /business/orders[/:id][/verify],
  GET|PUT /business/customers[/:id], GET /business/escalations[/:id/resolve],
  POST /business/marketing/broadcast, GET /admin/*, POST /webchat

## Palette

bg `#F0F2F5` · ink `#111B21` · muted `#667781` · primary `#075E54` ·
accent `#128C7E` · danger `#C62828`/`#FFF0F0` · warn `#856404`/`#FFF8E1`
