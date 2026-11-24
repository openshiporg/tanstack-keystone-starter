# Dashboard live smoke test - current item-page restoration

Date: 2026-05-13
Target: `http://localhost:3000`
Login used: `ada@example.com` / `password`

## Summary

**FAIL** - main restored item/create pages render real forms, but live smoke still shows navigation and console regressions.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `/dashboard/users/create` shows create form | PASS | After login, page renders `Create User`, editable textboxes, password field, relationship search inputs, selected related Role/Todo chips, and `Create related Role` / `Create related Todo` links. |
| `/dashboard/users/user_admin` shows real item edit page, not placeholder | PASS | Page renders breadcrumb `Dashboard > Users > Ada Admin`, `Delete`, `Reset`, `Save Changes`, heading `Ada Admin`, `Copy ID`, editable `name`/`email`/password fields, and relationship editors. No placeholder page observed. |
| Save / reset / copy buttons exist | PASS | On `user_admin` item page: `Reset` button exists (disabled while clean), `Save Changes` button exists (disabled while clean), `Copy ID` button exists. |
| Relationship editor create/view buttons | PARTIAL PASS | Item page has `Create related Role`, `View related details`, and `Create related Todo`. Create page has create-related links but no view-related link, which is expected for create flow. |
| Row click navigates | FAIL | On `/dashboard/users`, clicking the `user_editor` row did not change the URL; it remained `/dashboard/users?page=1&search=&sortBy=&fields=`. |
| `View` link navigates | FAIL | Clicking `View` links for user rows did not change the URL; it remained `/dashboard/users?page=1&search=&sortBy=&fields=`. |
| Console nativeButton/Base UI errors | FAIL | Console contains React `nativeButton` DOM prop warning and Base UI native button errors from sign-in and relationship field editor paths. |

## Console errors observed

Relevant console output included:

```text
[error] React does not recognize the `%s` prop on a DOM element ... nativeButton nativebutton
[error] Base UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics...
    at Button (http://localhost:3000/src/components/ui/button.tsx:33:25)
    at SignInRoute (.../src/routes/dashboard/signin.tsx...)
```

and on create/item relationship editors:

```text
[error] Base UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true...
    at Button (http://localhost:3000/src/components/ui/button.tsx:33:25)
    at RelationshipFieldEditor (http://localhost:3000/src/components/dashboard/relationship-field-editor.tsx:143:32)
    at FieldValueEditor (http://localhost:3000/src/components/dashboard/field-value-editor.tsx:266:26)
    at CreateField (.../src/routes/dashboard/$listKey.create.tsx...)
```

and:

```text
[error] Base UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true...
    at RelationshipFieldEditor (http://localhost:3000/src/components/dashboard/relationship-field-editor.tsx:143:32)
    at FieldValueEditor (http://localhost:3000/src/components/dashboard/field-value-editor.tsx:266:26)
    at ItemField (.../src/routes/dashboard/$listKey.$id.tsx...)
```

## Reproduction steps

1. Open `http://localhost:3000/dashboard/users/create`.
2. If redirected to sign-in, login with `ada@example.com` / `password`.
3. Confirm create form renders with heading `Create User`, form fields, relationship searches, related item chips, and create-related links.
4. Open `http://localhost:3000/dashboard/users/user_admin`.
5. Confirm item edit page renders real Ada Admin edit UI, including `Reset`, `Save Changes`, `Copy ID`, field editors, and relationship editor links.
6. Open `http://localhost:3000/dashboard/users`.
7. Click the `user_editor` row. Expected: navigate to user item page. Actual: URL remains `/dashboard/users?page=1&search=&sortBy=&fields=`.
8. Click a row `View` link. Expected: navigate to user item page. Actual: URL remains `/dashboard/users?page=1&search=&sortBy=&fields=`.
9. Inspect browser console. Expected: no nativeButton/Base UI errors. Actual: errors/warnings listed above are present.
