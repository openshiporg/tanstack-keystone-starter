# Dashboard create/item pages and field views audit

## Scope
Hostile audit of dashboard-only create/item pages and field views in local TanStack app versus upstream `next-keystone-starter/features/dashboard`.

## Create / item page differences

1. **Local create page has runtime admin-meta merge and field-mode awareness; upstream create page does not.**
   - Local merges `fieldMetaByPath`, `isNonNull`, and `createView` into enhanced fields before rendering, then computes grouped sidebar/form layout from that merged metadata: `src/routes/dashboard/$listKey.create.tsx:51-79`.
   - Upstream create page only calls `enhanceFields(list.fields || {}, list.key)` and never merges any runtime field metadata before rendering: `../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx:51-57`.
   - Consequence: any create-view behavior driven by server/runtime admin metadata can diverge immediately.

2. **Local create page has unsaved-change blocking and explicit validation/error state; upstream create page is much thinner.**
   - Local tracks `error`, `saving`, `showValidation`, computes `invalidFields`, and blocks navigation with `usePreventNavigation(hasChanges && !saving)`: `src/routes/dashboard/$listKey.create.tsx:46-49,71-81`.
   - Upstream only checks `createItem.props.invalidFields.size !== 0` in submit handler and has no route-blocking / dirty-state banner equivalent in the logic shown: `../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx:59-71`.

3. **Local create page honors sidebar field grouping; upstream hardcodes everything into main fields.**
   - Local computes `sidebarGroups` and renders sidebar/form regions separately via `EnhancedFormFields`: `src/routes/dashboard/$listKey.create.tsx:79,147-157`.
   - Upstream explicitly comments “For now, put all fields in main” and leaves `sidebarFields` empty: `../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx:110-121,158-185`.
   - This is a direct layout parity miss.

4. **Local item page properly deserializes from the full fetched item record; upstream item page deserializes each controller from a crippled single-field object.**
   - Local builds `currentDraft` from `field.controller.deserialize(itemRecord)` where `itemRecord = data.item ?? {}`: `src/routes/dashboard/$listKey.$id.tsx:89-92`.
   - Upstream’s `deserializeItemToValue` fabricates `itemForField[field.path] = item?.[field.path] ?? null` and passes only that partial object into each controller: `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:223-247`.
   - That upstream pattern is specifically bad for controllers whose `graphqlSelection` spans multiple fields or aliases.

5. **Local item page merges runtime `itemView` metadata and hides hidden fields; upstream item page does neither in the shown code.**
   - Local merges `runtimeMeta.itemView` and filters out `field.itemView.fieldMode === 'hidden'`: `src/routes/dashboard/$listKey.$id.tsx:72-88`.
   - Upstream only uses `enhanceFields(list.fields || {}, list.key)` and builds required-state from `enhancedFields` plus optional `list.adminMetaFields`; there is no equivalent hidden-field filtering in the shown logic: `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:255-295`.

## Field view differences

### Relationship

6. **Local relationship view is not the upstream implementation at all; it is a wrapper over a separate editor abstraction.**
   - Local editable rendering is just `RelationshipFieldEditor`, with local controller/value normalization layered around it: `src/components/dashboard/views/relationship.tsx:113-130,139-209`.
   - Upstream field rendering delegates to `ClientField` plus a much richer controller contract carrying `refListKey`, `refLabelField`, `refSearchFields`, `hideCreate`, `hideButtons`, cards options, etc.: `../next-keystone-starter/features/dashboard/views/relationship/index.tsx:19-50,256-314`.
   - Meaning: local is a behavioral rewrite, not a parity port.

7. **Relationship cell rendering differs materially.**
   - Local count mode shows raw count via generic text display: `src/components/dashboard/views/relationship.tsx:133-136`.
   - Upstream count mode pluralizes with related-list singular/plural labels: `../next-keystone-starter/features/dashboard/views/relationship/index.tsx:54-63`.
   - Local non-count cell goes through generic `displayFieldValue(field.kind, item[field.path])`: `src/components/dashboard/views/relationship.tsx:133-136`.
   - Upstream renders linked labels, truncates after two items, and appends overflow text: `../next-keystone-starter/features/dashboard/views/relationship/index.tsx:66-99`.

8. **Local relationship controller uses `fieldMeta.ui`; upstream expects flattened relationship metadata fields.**
   - Local pulls display config from `field.fieldMeta.ui` and normalizes `displayMode`, `cardFields`, `inlineConnect`, `removeMode`: `src/components/dashboard/views/relationship.tsx:27-39`.
   - Upstream controller reads `fieldMeta.displayMode`, `fieldMeta.cardFields`, `fieldMeta.inlineCreate`, `fieldMeta.inlineEdit`, `fieldMeta.linkToItem`, `fieldMeta.removeMode`, `fieldMeta.inlineConnect`, `fieldMeta.hideCreate`, `fieldMeta.hideButtons`: `../next-keystone-starter/features/dashboard/views/relationship/index.tsx:261-314`.
   - This is a metadata-shape mismatch, not just UI drift.

### Password

9. **Local password view mostly matches upstream behavior, but it still diverges in structure and helper data exposure.**
   - Local derives validation from raw `field.fieldMeta` at render time and returns only basic controller fields: `src/components/dashboard/views/password.tsx:45-73,238-259`.
   - Upstream controller materializes a `validation` object onto the controller and types against `PasswordFieldMeta`: `../next-keystone-starter/features/dashboard/views/password/index.tsx:303-320`.
   - Probably survivable, but not the same contract.

10. **Local password field adds extra validation hint copy that upstream does not show in the rendered field.**
   - Local always prints helper text for `rejectCommon` and `match` explanations: `src/components/dashboard/views/password.tsx:218-219`.
   - Upstream only renders the validation error message area and does not render those hint paragraphs in the shown field body: `../next-keystone-starter/features/dashboard/views/password/index.tsx:262-265`.

### Image / file

11. **Local has no dedicated file view at all; `file` is aliased to the image view.**
   - Local registry maps both `image` and `file` to `imageView`: `src/components/dashboard/views/registry.tsx:282-285`.
   - Upstream has `image` view files but no `file` view under `features/dashboard/views/file`, so local is piggybacking by design; still, dashboard behavior for `file` is therefore only whatever the image/file shared editor can fake.

12. **Local image controller is drastically weaker than upstream image controller.**
   - Local GraphQL selection defaults to just `config.path`: `src/components/dashboard/views/image.tsx:26-33`.
   - Upstream image controller explicitly selects `id`, `url`, `extension`, `filesize`, `width`, `height`: `../next-keystone-starter/features/dashboard/views/image/index.tsx:50-60`.
   - Local therefore depends on external injected selection or a more magical backend shape; otherwise it under-fetches image data.

13. **Local image/file validation is generic presence-only; upstream image validation checks MIME/image acceptance.**
   - Local validate only checks requiredness against `from-server` or `upload`: `src/components/dashboard/views/image.tsx:40-44`.
   - Upstream `validateImage` rejects non-image uploads and invalid file validity state: `../next-keystone-starter/features/dashboard/views/image/index.tsx:39-47,70-73`.

### Document

14. **Local document field is not a document editor anymore; it is a text/JSON shim.**
   - Local “visual” mode is a plain `<Textarea>` that converts line breaks into paragraph nodes; “json” mode is another raw textarea: `src/components/dashboard/views/document.tsx:22-60`.
   - Upstream renders the actual `DocumentEditor` with `componentBlocks`, `relationships`, `documentFeatures`, and validation provider: `../next-keystone-starter/features/dashboard/views/document/index.tsx:124-151`.
   - This is the biggest parity failure in the whole audit.

15. **Local document controller state shape is incompatible with upstream.**
   - Local `defaultValue` is `''`, deserialize returns either plain text or JSON string, and serialize reparses strings into document payloads: `src/components/dashboard/views/document.tsx:73-118`.
   - Upstream `defaultValue` is a Slate descendant array with an empty paragraph, deserialize returns normalized editor children, and controller exposes `componentBlocks`, `documentFeatures`, and `relationships`: `../next-keystone-starter/features/dashboard/views/document/index.tsx:152-240`.
   - Local is string-based; upstream is Slate-node-based. That is not parity.

16. **Local document controller can silently accept non-JSON raw text as valid structured content.**
   - Local `validate` returns `true` on non-empty raw strings if JSON parse fails, because it assumes text-to-document fallback is valid: `src/components/dashboard/views/document.tsx:107-117`.
   - Upstream validates actual editor node structure through Slate/component-block/link validation inside controller construction: `../next-keystone-starter/features/dashboard/views/document/index.tsx:165-210`.

### Text

17. **Local text field drops nullable semantics, display mode choice, regex/length validation, and exact controller state shape.**
   - Local is just a string `<Input>` with trimmed required validation and `serialize` to `undefined` for empty: `src/components/dashboard/views/text.tsx:5-50`.
   - Upstream uses `TextValue`/`InnerTextValue`, nullable toggling, textarea vs input mode, regex/length validation, and preserves previous value when nulling: `../next-keystone-starter/features/dashboard/views/text/index.tsx:16-24,48-93,143-210,233-276`.
   - Local text view is a stub compared with upstream.

18. **Local text controller omits all filter support present upstream.**
   - Local controller ends at `validate`: `src/components/dashboard/views/text.tsx:34-50`.
   - Upstream controller includes full text filter UI/GraphQL/parseGraphQL/types logic: `../next-keystone-starter/features/dashboard/views/text/index.tsx:277-320`.

### Select / multiselect

19. **Local select view partially reimplements upstream but still loses contract surface and filter support.**
   - Local supports segmented-control/radio/select and multiselect checkboxes, with nullable checkbox: `src/components/dashboard/views/select.tsx:58-188`.
   - Upstream controller includes filter types/GraphQL parsing and uses richer field props/types; local controller ends at basic validation: `../next-keystone-starter/features/dashboard/views/select/index.tsx:1-60,233+` (filter/controller logic continues beyond the shown field/cell block), while local ends at `validate`: `src/components/dashboard/views/select.tsx:202-228`.

20. **Local multiselect UX is simpler and not parity-grade.**
   - Local multiselect uses raw `<input type="checkbox">` list with no field container, descriptions, or upstream selection components: `src/components/dashboard/views/select.tsx:82-103`.
   - Upstream architecture has dedicated multiselect view file and richer dashboard field plumbing under `views/multiselect/index.tsx` / shared select controller family in upstream tree, rather than this stripped checkbox list.

### Number / integer / float / decimal / bigInt

21. **Local collapses four upstream views into one generic number view, losing per-type contracts and filter support.**
   - Local registry maps `integer`, `float`, `decimal`, `bigInt` all to `numberView`: `src/components/dashboard/views/registry.tsx:275-278`.
   - Upstream has separate implementations for `integer`, `float`, `decimal`, and `bigInt`: `../next-keystone-starter/features/dashboard/views/integer/index.tsx`, `.../float/index.tsx`, `.../decimal/index.tsx`, `.../bigInt/index.tsx`.
   - This means local consciously flattened distinct behaviors.

22. **Local number cells render plain strings; upstream uses monospaced numeric formatting and type-specific display.**
   - Local cell: `String(value)` for every numeric kind: `src/components/dashboard/views/number.tsx:226-231`.
   - Upstream integer cell uses monospaced output: `../next-keystone-starter/features/dashboard/views/integer/index.tsx:130-137`.
   - Upstream float/decimal cells format with locale precision limits: `../next-keystone-starter/features/dashboard/views/float/index.tsx:106-113`, `../next-keystone-starter/features/dashboard/views/decimal/index.tsx:122-129`.

23. **Local bigInt/integer autoincrement rendering differs from upstream.**
   - Local integer create autoincrement shows `value="Auto increment"` with inline info block; local bigInt does similar text handling: `src/components/dashboard/views/number.tsx:133-145,174-183`.
   - Upstream integer autoincrement uses `Alert` component: `../next-keystone-starter/features/dashboard/views/integer/index.tsx:72-91`.
   - Upstream bigInt autoincrement uses `defaultValue="--"` and lighter helper text: `../next-keystone-starter/features/dashboard/views/bigInt/index.tsx:215-235`.

24. **Local number controller omits all upstream filter logic.**
   - Local controller is only serializer/validator logic in the shown file: `src/components/dashboard/views/number.tsx:233-260+`.
   - Upstream integer/float/decimal/bigInt controllers all expose filter UIs, GraphQL translators, parseGraphQL, and filter types: `../next-keystone-starter/features/dashboard/views/integer/index.tsx:181-250+`, `../next-keystone-starter/features/dashboard/views/float/index.tsx:154-217+`, `../next-keystone-starter/features/dashboard/views/decimal/index.tsx:187-254`, `../next-keystone-starter/features/dashboard/views/bigInt/index.tsx:89-197`.

### Timestamp

25. **Local timestamp view is a stub; upstream is a full date+time picker with special required/default semantics.**
   - Local field is only `<Input type="datetime-local">`, string-based deserialize/serialize, and trimmed required validation: `src/components/dashboard/views/timestamp.tsx:5-50`.
   - Upstream uses structured `{ kind, value, initial }`, validates `defaultValue.kind === 'now'` / `updatedAt`, renders calendar+time popover, and formats cell output: `../next-keystone-starter/features/dashboard/views/timestamp/index.tsx:30-108,132-209,233-264`.
   - Local timestamp parity is nowhere close.

26. **Local timestamp cell leaks raw stored string; upstream formats for humans.**
   - Local cell echoes `String(item[field.path] ?? '').trim()`: `src/components/dashboard/views/timestamp.tsx:29-31`.
   - Upstream cell formats `MMM d, yyyy p`: `../next-keystone-starter/features/dashboard/views/timestamp/index.tsx:212-218`.

### JSON

27. **Local JSON field is close to upstream but still rewrites read-only display behavior.**
   - Local read-only field renders a full `<pre>` block and cell collapses to `Complex data`: `src/components/dashboard/views/json.tsx:20-31`.
   - Upstream editable field is wrapped in `FieldContainer`, and cell shows a truncated serialized JSON snippet: `../next-keystone-starter/features/dashboard/views/json/index.tsx:46-67,70-84`.
   - Less severe than document/text/timestamp, but still not upstream behavior.

28. **Local JSON serializer will throw on invalid JSON if called directly; upstream degrades to `undefined`.**
   - Local `serialize` does `JSON.parse(raw)` with no try/catch: `src/components/dashboard/views/json.tsx:42-45`.
   - Upstream wraps parse and returns `{ [config.path]: undefined }` on invalid JSON: `../next-keystone-starter/features/dashboard/views/json/index.tsx:135-141`.
   - Local relies on validation firing first; that is brittle.

### Checkbox

29. **Local checkbox rendering is simplified and loses upstream semantics and filter support.**
   - Local editable field is just a bordered row with checkbox + muted label, read-only is `Yes`/`No` badge, and controller ends at `validate`: `src/components/dashboard/views/checkbox.tsx:7-42`.
   - Upstream uses `FieldContainer`, label/description wiring, read-only disabled checkbox, boolean cell checkbox, and filter implementation: `../next-keystone-starter/features/dashboard/views/checkbox/index.tsx:34-76,91-153`.

30. **Local checkbox cell is a badge, upstream cell is an actual disabled checkbox.**
   - Local: `Yes`/`No` badge: `src/components/dashboard/views/checkbox.tsx:26-28`.
   - Upstream: disabled checkbox with aria-label: `../next-keystone-starter/features/dashboard/views/checkbox/index.tsx:65-76`.

## Bottom line

- **Hard failures / non-parity rewrites:** document, text, timestamp, relationship, number family.
- **Medium drift:** image/file, checkbox, select/multiselect, create page layout/grouping.
- **Small drift:** password, JSON.

If you want true upstream parity, the local dashboard is not missing polish; it is missing entire controller/state contracts for several field types.