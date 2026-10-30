# Multi-vendor e-commerce ordering management system

A beginner-friendly full-stack marketplace called **MarketHub**. Multiple vendors can publish products, customers can search products and place orders, and the application stores records in Supabase PostgreSQL.

## 1. Project overview

### Problem statement
Small sellers may sell through separate channels, making it difficult for customers to compare products and manage orders in one place. This project demonstrates a single marketplace where multiple vendors can list products and customers can order products from those vendors.

### Objectives
- Build a responsive marketplace using HTML, CSS, and Vanilla JavaScript.
- Use Node.js and Express.js for server-side validation and API routes.
- Store user profiles, products, orders, and order items in Supabase PostgreSQL.
- Demonstrate customer/vendor roles and safe order creation.
- Practice REST APIs, SQL relationships, authentication, and Git/GitHub.

### Roles
- **Customer:** browse/search products, add items to a cart, place orders, and view personal orders.
- **Vendor:** add products and view/delete their own listings.
- There is no admin dashboard in this MVP. Account roles are limited to `customer` and `vendor`.

### Implemented features
- Registration and sign-in with bcrypt password hashing and signed JWTs.
- Product listing, category filtering, and name search.
- Vendor product creation and soft deletion.
- Shopping cart in the browser and checkout with delivery address.
- Transactional database order creation, stock checking/decrement, and order history.
- Responsive layout, input validation, error messages, security headers, and login/register rate limiting.

### Technology stack
HTML5, CSS3, Vanilla JavaScript, Node.js 20+, Express.js, Supabase PostgreSQL, Git, and GitHub. Required npm packages: `express`, `@supabase/supabase-js`, `bcryptjs`, `jsonwebtoken`, `dotenv`, `helmet`, `cors`, and `express-rate-limit`.

## 2. Folder structure

```text
multi-vendor-e-commerce-ordering-management-system/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   └── api.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 3. Prerequisites

Install:
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js LTS](https://nodejs.org/) (Node.js 20 or later)
- [Git](https://git-scm.com/)
- A free [Supabase](https://supabase.com/) account

Verify Node.js/npm/Git by opening a terminal and running:

```bash
node --version
npm --version
git --version
```

## 4. Database setup in Supabase

1. Sign in to Supabase and create a new project.
2. Wait for the database to finish provisioning.
3. In the project dashboard, open **SQL Editor** and create a new query.
4. Open `database/schema.sql` in VS Code, copy the entire file, paste it into the SQL Editor, and click **Run**.
5. Open **Table Editor**. Confirm these tables exist: `profiles`, `products`, `orders`, and `order_items`.
6. The schema also creates `place_marketplace_order`, a PostgreSQL function that creates an order and updates stock in one transaction.

This application uses a server-side Supabase service-role key, so all database requests go through the Express API. Row Level Security is enabled and there are intentionally no browser-accessible policies. Never put the service-role key in frontend files or publish it.

## 5. Environment variables

1. In VS Code, open `backend/.env.example`.
2. Copy it and name the copy `.env` inside the same `backend` folder.
3. In Supabase, open **Project Settings → API** (the dashboard wording may vary) and copy the Project URL and service-role/secret key for server use.
4. Paste your own values into `backend/.env`:

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_KEY
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=2h
```

Generate a strong JWT secret from the project root or any terminal:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use the generated value for `JWT_SECRET`. Keep `.env` private. `.env.example` is safe to commit because it contains placeholders only. Do not paste real credentials into chat or GitHub.

## 6. Install and run (Windows-friendly)

1. Extract the ZIP into a folder you can find easily.
2. Open VS Code → **File → Open Folder** → select `multi-vendor-e-commerce-ordering-management-system`.
3. Choose **Terminal → New Terminal**.
4. Move into the backend folder:

```bash
cd backend
```

5. Install the dependencies:

```bash
npm install
```

6. Create and fill `backend/.env` as explained above. Make sure `database/schema.sql` has been run in Supabase.
7. Check JavaScript syntax:

```bash
npm run check
```

8. Start the server:

```bash
npm start
```

Expected terminal message: `MarketHub server running at http://localhost:3000`.
9. Open `http://localhost:3000` in your browser. Do not open `index.html` directly; the page uses the Express API.
10. Create a customer account to place orders. Create a separate vendor account to add products.

For development with automatic server restart, use `npm run dev` instead of `npm start`.

## 7. How to use the application

1. Click **Sign in → Create an account**.
2. Create a vendor account and add a product from **Seller dashboard**.
3. Sign out and create/sign in with a customer account.
4. Browse products, use search/category filters, and add items to the cart.
5. Open the cart, enter a delivery address, and place the order.
6. Open **My orders** to view the order and total.
7. Return to the vendor account to manage product listings. Product stock decreases after a successful order.

No sample products or fake customer records are inserted automatically. Add products using the vendor dashboard.

## 8. API reference

All routes are prefixed with `/api`. JSON errors use `{ "error": "Readable message" }`.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Server health check | Public |
| POST | `/api/auth/register` | Create a customer/vendor account | Public; rate limited |
| POST | `/api/auth/login` | Sign in and receive a JWT | Public; rate limited |
| GET | `/api/auth/me` | Get current profile | Signed-in user |
| GET | `/api/products` | List active products; optional `?search=name` | Public |
| GET | `/api/vendor/products` | List products owned by the vendor | Vendor |
| POST | `/api/vendor/products` | Create a product | Vendor |
| DELETE | `/api/vendor/products/:id` | Remove own product from listings | Vendor |
| POST | `/api/orders` | Place an order and decrement stock | Customer |
| GET | `/api/orders/mine` | List the customer's own orders | Customer |

### Example request bodies

Register:
```json
{
  "name": "Sample Seller",
  "email": "seller@example.com",
  "password": "choose-a-strong-password",
  "role": "vendor"
}
```

Add product (send `Authorization: Bearer YOUR_TOKEN`):
```json
{
  "name": "Notebook",
  "description": "A ruled notebook for everyday notes.",
  "category": "Stationery",
  "price": 80,
  "stock": 25
}
```

Place order (customer token required):
```json
{
  "address": "12 Main Road, Hyderabad, 500001",
  "items": [
    { "product_id": "UUID_FROM_PRODUCT_LIST", "quantity": 2 }
  ]
}
```

Successful responses include the created resource or a confirmation. Common status codes are `400` invalid input, `401` missing/invalid login, `403` wrong role, `404` missing resource, `409` duplicate email, `429` too many authentication requests, and `500` server/database configuration error.

## 9. Architecture and security

- The browser serves HTML/CSS/JS and uses `fetch()` to call Express.
- Express validates input, checks the JWT and role, and calls Supabase.
- PostgreSQL stores persistent records. The `place_marketplace_order` function locks product rows, checks stock, creates order items, updates stock, and calculates the total in one transaction.
- Passwords are stored as bcrypt hashes, never plaintext.
- The service-role key is only read by the backend from `.env`; it must never be used in frontend JavaScript.
- JWTs expire after two hours by default. This student MVP stores the token in browser local storage, which is convenient for a demonstration but is more exposed to XSS than a carefully configured HttpOnly cookie. Do not use this prototype as-is for a production store.
- Vendors can only manage products whose `vendor_id` matches their verified token subject. Customers can only see their own orders.
- RLS is enabled on all tables. The server uses the service-role key, so authorization is enforced in Express and SQL function checks. If changing the design to direct browser-to-Supabase calls, add and test suitable RLS policies first.
- Do not publish `.env`, database passwords, real customer details, or service keys.

## 10. Testing checklist

| Test | Expected result |
|---|---|
| Visit `/api/health` | JSON response with `status: ok` |
| Register a customer | Account created and user is signed in |
| Register the same email twice | Friendly duplicate-email error |
| Register with invalid email or short password | Validation error |
| Sign in with wrong password | Generic sign-in error |
| Open vendor dashboard as customer | Product management denied |
| Add a valid product as vendor | Product appears in marketplace |
| Add product with negative price/stock | Request rejected |
| Delete another vendor's product ID | No product is changed; not-found response |
| Search/filter products | Matching products are shown |
| Place order with sufficient stock | Order is saved and stock decreases |
| Place order with insufficient stock | Order is rejected; transaction rolls back |
| Open orders while signed out | Sign-in prompt appears |
| Customer requests another customer's order | API only returns orders for the token owner |
| Stop Supabase or use incorrect credentials | Database error is shown without exposing secrets |
| Resize browser to mobile width | Navigation and product cards adapt to screen |

## 11. Troubleshooting

- **`SUPABASE_URL` / key error:** ensure `backend/.env` exists and the values are correct; restart the server after changing it.
- **Products do not load / database error:** run all of `database/schema.sql` in the correct Supabase project and check the server terminal.
- **`JWT_SECRET` error:** use a random secret of at least 32 characters.
- **`npm` is not recognized:** install Node.js LTS, then close and reopen the terminal.
- **Port already in use:** change `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.
- **Order cannot be placed:** check that the product is active and stock is sufficient.
- **`npm run check` fails:** confirm you're in the `backend` directory and using Node.js 20 or later.

## 12. Git and GitHub

1. Create a new empty repository on GitHub. Do not upload secrets.
2. Open a terminal at the **project root** (one level above `backend`).
3. Run:

```bash
git init
git status
git add .
git status
git commit -m "Build multi-vendor marketplace"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual GitHub repository URL. Before `git add .`, confirm `.env` and `node_modules/` are ignored and `backend/.env.example` is included. If a secret was already committed, `.gitignore` alone is not enough: rotate the secret immediately and remove it from Git history.

## 13. Limitations and future improvements

This MVP intentionally omits payment gateway integration, shipment tracking, coupons, reviews, vendor payouts, admin moderation, order cancellation, and email notifications. Useful future improvements include order status updates, pagination, product images, an admin dashboard, email verification, HttpOnly cookie sessions, and automated integration tests.

## 14. Final verification checklist

- [x] Required `frontend/`, `backend/`, and `database/` directories included.
- [x] Root README and environment template included.
- [x] Frontend routes match Express API routes.
- [x] SQL tables/columns match backend queries.
- [x] Vendor/customer role checks included.
- [x] Password hashing and token expiration included.
- [x] Order placement uses a PostgreSQL transaction and stock row locks.
- [x] No real credentials or auto-generated demo products included.

**Important:** A live Supabase connection cannot work until you create a project and enter your own credentials in `backend/.env`.
