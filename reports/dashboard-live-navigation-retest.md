# Dashboard live navigation retest

Date: 2026-05-12
Target tried first: `http://localhost:3000`
Secondary target: `https://tanstack.local` returned `502 Bad Gateway`, so live QA was performed against localhost.
Auth state: already logged in as `ada@example.com` / Ada Admin; no login form appeared.

## Results

- Dashboard Users card link: **PASS with real DOM click / INCONCLUSIVE via agent-browser ref click**
  - Anchor href is `http://localhost:3000/dashboard/users`.
  - Executing a real DOM click on the Users card anchor changed URL to `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`.
  - `agent-browser click @e10` did not change URL despite the element snapshot being a link, so I did not count that as an app failure.
- Dashboard create user link: **PASS with real DOM click / INCONCLUSIVE via agent-browser ref click**
  - Anchor href is `http://localhost:3000/dashboard/users/create`.
  - Executing a real DOM click changed URL to `http://localhost:3000/dashboard/users/create?page=1&search=&sortBy=&fields=` and displayed the create form (`Create User`, fields, relationship editors).
  - `agent-browser click @e11` did not change URL despite the element snapshot being a link.
- Direct `/dashboard/users/create`: **PASS**
  - URL normalized to `/dashboard/users/create?page=1&search=&sortBy=&fields=`.
  - Create form displayed with `Create User`, field inputs, role/tasks relationship controls, and `Create User` submit button.
- Direct `/dashboard/users/user_admin`: **PARTIAL / FAIL for item-page content**
  - URL normalized to `/dashboard/users/user_admin?page=1&search=&sortBy=&fields=`.
  - It did **not** show the list page, but the page content was only `Hello "/dashboard/$listKey/$id"!` rather than a usable user item/detail page.
- Users table row click: **PASS**
  - Clicking the first row navigated from `/dashboard/users?...` to `/dashboard/users/user_admin?page=1&search=&sortBy=&fields=`.
- Users table `View` link: **FAIL / INCONCLUSIVE**
  - The first-row `View` anchor is present in the table snapshot.
  - `agent-browser click @e55` left the page at `/dashboard/users?page=1&search=&sortBy=&fields=`; no item navigation occurred in that run.
- Console nativeButton warning: **FAIL**
  - Console still contains `React does not recognize the nativeButton prop on a DOM element...`.
  - Console also contains `Base UI: A component that acts as a button expected a native <button> because the nativeButton prop is true...` from `RelationshipFieldEditor` on the create route.
- Critical errors: **FAIL**
  - The nativeButton/Base UI messages are logged as console errors. `agent-browser errors` did not report uncaught page exceptions.

## Summary

Some navigation fixes are working at the route/anchor level, especially direct create and table-row navigation. Remaining issues found: `https://tanstack.local` unavailable, item detail route still renders placeholder content, `View` link did not navigate via the browser automation click, and nativeButton/Base UI console errors are still present.
