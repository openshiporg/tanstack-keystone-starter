# Code Context

## Files Retrieved
1. `/Users/junaid/code/openfront/app/(storefront)/[countryCode]/(main)/layout.tsx` (lines 1-3) - storefront route group entry delegates to `MainLayout` screen.
2. `/Users/junaid/code/openfront/app/(storefront)/[countryCode]/(main)/page.tsx` (lines 1-5) - home route delegates to `features/storefront/screens/HomePage` and exports `generateMetadata`.
3. `/Users/junaid/code/openfront/app/(storefront)/[countryCode]/(main)/products/[handle]/page.tsx` (lines 1-5) - product route delegates to screen and metadata.
4. `/Users/junaid/code/openfront/features/storefront/screens/StorefrontServer.tsx` (lines 1-94) - SSR prefetch/hydration boundary using TanStack Query.
5. `/Users/junaid/code/openfront/features/storefront/lib/config.ts` (lines 1-38) - GraphQL client with dynamic endpoint resolution.
6. `/Users/junaid/code/openfront/features/storefront/lib/data/products.ts` (lines 1-220) - product/catalog GraphQL operations including custom `getProductsSortedByPrice`.
7. `/Users/junaid/code/openfront/features/storefront/lib/data/collections.ts` (lines 1-138) - collection queries and product-in-collection shape.
8. `/Users/junaid/code/openfront/features/storefront/lib/data/regions.ts` (lines 1-49) - region/country/currency queries.
9. `/Users/junaid/code/openfront/features/storefront/lib/data/cart.ts` (lines 1-220 sampled; file is large) - cart lifecycle, checkout actions, cookies/session coupling, many custom mutations.
10. `/Users/junaid/code/openfront/features/storefront/lib/data/orders.ts` (lines 1-78) - order retrieval uses custom `getCustomerOrder/getCustomerOrders`.
11. `/Users/junaid/code/openfront/features/storefront/lib/data/payment.ts` (lines 1-52) - payment provider/session custom ops.
12. `/Users/junaid/code/openfront/features/storefront/lib/data/cookies.ts` (lines 1-51) - uses Next `cookies()` and Keystone session cookie naming.
13. `/Users/junaid/code/openfront/features/keystone/index.ts` (lines 1-220 sampled) - Keystone config, auth/session/storage/custom schema extension source.
14. `/Users/junaid/code/openfront/features/keystone/models/index.ts` (lines 1-174) - full domain model registry used by Openfront backend.
15. `/Users/junaid/code/openfront/package.json` - confirms Next 16 app router + Keystone + GraphQL stack.
16. `/Users/junaid/code/openfront/keystone.ts` - entrypoint imports `features/keystone` config.
17. `/Users/junaid/code/tanstack-keystone-starter/src/routes/api/graphql.ts` - TanStack starter GraphQL endpoint available at `/api/graphql`.
18. `/Users/junaid/code/tanstack-keystone-starter/cms.config.ts` - starter CMS models and current schema extension scope.
19. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/models/index.ts` and `{User,Role}.ts` - confirms current backend slice is not commerce-ready.
20. `/Users/junaid/code/tanstack-keystone-starter/backend-dynamic-prisma-runtime-output.md` - dynamic runtime status + limitations.
21. `/Users/junaid/code/tanstack-keystone-starter/backend-keystone-model-compat-output.md` - model compatibility and remaining parity gaps.

## Key Code
- **Storefront route strategy**: Openfront app routes are mostly thin wrappers around `features/storefront/screens/*`; this makes copying screen/modules feasible if router adapters are added.
- **Next-specific surface (high impact):**
  - `next/navigation`: `notFound`, `redirect`, `useRouter`, `usePathname`, `useSearchParams`, `useParams` (widespread in `features/storefront/modules/*` and screen files).
  - `next/link`, `next/image`, `next/font/google`, `next/dynamic`, `next/headers` (`cookies`, `headers`), `next/cache` (`revalidateTag`).
  - `generateMetadata` and static `metadata` exports in many screen files.
  - app-router conventions: route groups, parallel routes (`@dashboard`, `@login`), dynamic segments.
- **GraphQL dependency style**: storefront strongly depends on Keystone GraphQL (both generated CRUD and custom mutations/queries), via `openfrontClient.request(gql...)` in `features/storefront/lib/data/*`.
- **Critical custom operations used by storefront (non-generic CRUD)** include:
  - cart/payment/checkout: `activeCart`, `updateActiveCart`, `updateActiveCartLineItem`, `createActiveCartPaymentSessions`, `setCartPaymentSession`, `addActiveCartShippingMethod`, `addDiscountToActiveCart`, `removeDiscountFromActiveCart`, `completeActiveCart`, `initiatePaymentSession`, `activeCartPaymentProviders`, `activeCartShippingOptions`.
  - account/order/business: `getCustomerOrder`, `getCustomerOrders`, `getCustomerAccounts`, `getCustomerPaidInvoices`, `createBusinessAccountRequest`, `regenerateCustomerToken`.
  - catalog custom: `getProductsSortedByPrice`.
- **Starter runtime support reality** (`tanstack-keystone-starter`):
  - Has GraphQL runtime + dynamic list support foundations.
  - Canonical models are `User`, `Role`, `Todo`, `TodoImage` only.
  - No built-in equivalent for Openfront’s custom commerce operations/auth/session/storage parity yet.

## Architecture
- Openfront storefront is split into:
  1) **Next app routing layer** (`app/(storefront)/...`) that delegates to
  2) **screen layer** (`features/storefront/screens/*`) that composes
  3) **module/component layer** (`features/storefront/modules/*`) backed by
  4) **data layer** (`features/storefront/lib/data/*`) making GraphQL calls to Keystone.
- Therefore migration can be separated into two tracks:
  - **Frontend portability track**: adapt routing/navigation/image/link/metadata/caching APIs from Next to TanStack Start.
  - **Backend contract track**: satisfy GraphQL contract expected by data layer (models + custom ops).

## Migration Decision (5)
**Do not copy storefront UI alone** as first runnable milestone if “smoke” includes cart/checkout/account.

Recommended staged decision:
1. **Stage A (safe first slice): storefront shell + read-only catalog** (home/store/collection/product/category), with a **representative model slice** (Product, ProductVariant, ProductCollection, ProductCategory, Region, Country, MoneyAmount/Currency minimally).
2. **Stage B: cart + checkout** after implementing minimal custom cart/payment mutations.
3. **Stage C: account/orders/business** last (largest custom auth/session dependency).

Reason: UI files are copyable, but `lib/data/*` immediately calls custom operations absent from starter runtime.

## File-by-File Migration Plan
1. **Routing shell copy (frontend-first)**
   - Copy from Openfront:
     - `features/storefront/screens/*`
     - `features/storefront/modules/*`
     - `features/storefront/lib/{query-keys.ts,providers/*,types/*,util/*}`
   - Do **not** directly copy `app/(storefront)` pages into TanStack; instead map each to `src/routes/...` in TanStack Start.
   - Create an adapter layer for `notFound/redirect/params/search`.

2. **Replace Next APIs (systematic pass)**
   - `next/link` -> TanStack Link wrapper.
   - `next/navigation` hooks -> TanStack router hooks.
   - `notFound` -> throw/return route-level 404 handling.
   - `redirect` -> TanStack redirect utilities.
   - `next/image` -> standard `img` or custom image component first.
   - `next/font/google` -> local/fontsource imports.
   - `next/cache revalidateTag` -> remove initially or replace with React Query invalidation semantics.
   - `next/headers cookies/headers` -> server request context/cookie helpers in TanStack server handlers.
   - `metadata/generateMetadata` -> TanStack document head/route meta functions.

3. **Data layer fork for migration**
   - Copy `features/storefront/lib/data/*` but split into:
     - `catalog` operations (can run earlier)
     - `cart/checkout/account` operations (feature-flagged until backend ops exist).
   - Rework `