import { cmsLists } from '../src/features/cms/registry'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { relationship, text } from '../src/features/cms/keystone/fields'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function main() {
  const schema = printCmsPrismaSchema(cmsLists)
  assert(
    schema.includes('budget Decimal @default("0.00")'),
    'generated Prisma schema should emit Todo.budget as Prisma Decimal instead of String',
  )
  assert(
    schema.includes('largeNumber BigInt?'),
    'generated Prisma schema should emit Todo.largeNumber as Prisma BigInt instead of String',
  )

  const uuidLists = initialiseLists(
    config({
      db: { idField: { kind: 'uuid' } },
      lists: { UuidThing: list({ fields: { title: text() } }) },
    }),
  )
  const uuidSchema = printCmsPrismaSchema(uuidLists)
  assert(
    uuidSchema.includes('id String @id @default(uuid())'),
    'generated Prisma schema should honor db.idField.kind=uuid for id defaults',
  )

  const autoincrementLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        CounterThing: list({ fields: { title: text() } }),
        EventThing: list({
          fields: {
            counter: relationship({ ref: 'CounterThing' }),
            counters: relationship({ ref: 'CounterThing', many: true }),
          },
        }),
      },
    }),
  )
  const autoincrementSchema = printCmsPrismaSchema(autoincrementLists)
  assert(
    autoincrementSchema.includes('id Int @id @default(autoincrement())'),
    'generated Prisma schema should honor db.idField.kind=autoincrement with a Prisma-native Int id type and autoincrement default',
  )
  assert(
    autoincrementSchema.includes('counterId Int?'),
    'generated Prisma schema should emit Int foreign keys for relationships targeting autoincrement id lists',
  )
  assert(
    autoincrementSchema.includes(
      'counter CounterThing? @relation(fields: [counterId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should attach relation metadata including onUpdate using Int foreign keys for autoincrement related ids',
  )
  assert(
    autoincrementSchema.includes('counters CounterThing[]'),
    'generated Prisma schema should keep autoincrement to-many relationships as relation fields without inventing a local foreign key on the many side',
  )

  const cuidLists = initialiseLists(
    config({
      db: { idField: { kind: 'cuid' } },
      lists: { CuidThing: list({ fields: { title: text() } }) },
    }),
  )
  const cuidSchema = printCmsPrismaSchema(cuidLists)
  assert(
    cuidSchema.includes('id String @id @default(cuid())'),
    'generated Prisma schema should honor db.idField.kind=cuid for id defaults',
  )

  assert(
    schema.includes('roleId String?'),
    'generated Prisma schema should emit foreign key columns for one-sided User.role ownership',
  )
  assert(
    schema.includes(
      'role Role? @relation(fields: [roleId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should attach relation metadata including onUpdate to owned User.role foreign key',
  )
  assert(
    schema.includes('assignedToId String?'),
    'generated Prisma schema should emit foreign key columns for one-sided Todo.assignedTo ownership',
  )
  assert(
    schema.includes(
      'assignedTo User? @relation(fields: [assignedToId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should attach relation metadata including onUpdate to owned Todo.assignedTo foreign key',
  )
  assert(
    schema.includes('tasks Todo[]'),
    'generated Prisma schema should keep inverse to-many User.tasks without inventing a foreign key on the many side',
  )
  assert(
    schema.includes('assignedTo User[]'),
    'generated Prisma schema should keep inverse to-many Role.assignedTo without inventing a foreign key on the many side',
  )
  assert(
    schema.includes('todoImages TodoImage[] @relation("TodoImages")'),
    'generated Prisma schema should preserve explicit many-to-many relationName/joinTableName metadata for Todo.todoImages',
  )
  assert(
    schema.includes('todos Todo[] @relation("TodoImages")'),
    'generated Prisma schema should preserve explicit many-to-many relationName/joinTableName metadata for TodoImage.todos',
  )

  const mappedLists = initialiseLists(
    config({
      lists: {
        Post: list({
          db: { map: 'blog_posts' },
          fields: {
            title: text(),
          },
        }),
      },
    }),
  )
  const mappedSchema = printCmsPrismaSchema(mappedLists)
  assert(
    mappedSchema.includes('@@map("blog_posts")'),
    'generated Prisma schema should emit list-level @@map(...) when db.map is configured',
  )

  const namedManyOneSideOnlyLists = initialiseLists(
    config({
      lists: {
        Tag: list({
          fields: {
            posts: relationship({
              ref: 'Post.tags',
              many: true,
              db: { relationName: 'TagPosts' },
            }),
          },
        }),
        Post: list({
          fields: {
            tags: relationship({ ref: 'Tag.posts', many: true }),
          },
        }),
      },
    }),
  )
  const namedManyOneSideOnlySchema = printCmsPrismaSchema(
    namedManyOneSideOnlyLists,
  )
  assert(
    namedManyOneSideOnlySchema.includes('posts Post[] @relation("TagPosts")'),
    'generated Prisma schema should preserve explicit many-to-many relationName on the named side when only one side sets db.relationName',
  )
  assert(
    namedManyOneSideOnlySchema.includes('tags Tag[] @relation("TagPosts")'),
    'generated Prisma schema should propagate explicit many-to-many relationName to the unnamed opposite side when only one side sets db.relationName',
  )

  const oneToOneForeignKeyLists = initialiseLists(
    config({
      lists: {
        User: list({
          fields: {
            profile: relationship({
              ref: 'Profile.user',
              db: { foreignKey: { map: 'profile_id' } },
            }),
          },
        }),
        Profile: list({
          fields: {
            user: relationship({ ref: 'User.profile' }),
          },
        }),
      },
    }),
  )
  const oneToOneForeignKeySchema = printCmsPrismaSchema(oneToOneForeignKeyLists)
  assert(
    oneToOneForeignKeySchema.includes(
      'profileId String? @unique @map("profile_id")',
    ),
    'generated Prisma schema should emit a unique mapped foreign-key scalar for the owning side of a one-to-one relationship',
  )
  assert(
    oneToOneForeignKeySchema.includes(
      'profile Profile? @relation(fields: [profileId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should emit owning-side relation args for the owning side of a one-to-one relationship',
  )
  assert(
    oneToOneForeignKeySchema.includes('user User?'),
    'generated Prisma schema should preserve the non-owning side relation field for a one-to-one relationship',
  )

  const mappedManyToManyLists = initialiseLists(
    config({
      lists: {
        MappedCategory: list({
          db: { map: 'mapped_categories' },
          fields: {
            posts: relationship({
              ref: 'MappedPost.categories',
              many: true,
              db: { relationName: 'MappedPostCategories' },
            }),
          },
        }),
        MappedPost: list({
          db: { map: 'mapped_posts' },
          fields: {
            categories: relationship({
              ref: 'MappedCategory.posts',
              many: true,
              db: { relationName: 'MappedPostCategories' },
            }),
          },
        }),
      },
    }),
  )
  const mappedManyToManySchema = printCmsPrismaSchema(mappedManyToManyLists)
  assert(
    mappedManyToManySchema.includes(
      'posts MappedPost[] @relation("MappedPostCategories")',
    ),
    'generated Prisma schema should preserve explicit many-to-many relation naming when the related list is mapped',
  )
  assert(
    mappedManyToManySchema.includes(
      'categories MappedCategory[] @relation("MappedPostCategories")',
    ),
    'generated Prisma schema should preserve explicit many-to-many relation naming when both lists are mapped',
  )
  assert(
    mappedManyToManySchema.includes('@@map("mapped_categories")'),
    'generated Prisma schema should preserve mapped related-list @@map(...) when the mapped list participates in explicit many-to-many relations',
  )
  assert(
    mappedManyToManySchema.includes('@@map("mapped_posts")'),
    'generated Prisma schema should preserve mapped source-list @@map(...) when the mapped list participates in explicit many-to-many relations',
  )

  const mappedOwnedRelationshipLists = initialiseLists(
    config({
      lists: {
        MappedRole: list({
          db: { map: 'mapped_roles' },
          fields: {
            members: relationship({ ref: 'MappedUser.role', many: true }),
          },
        }),
        MappedUser: list({
          db: { map: 'mapped_users' },
          fields: {
            role: relationship({
              ref: 'MappedRole.members',
              db: { foreignKey: { map: 'mapped_role_id' } },
            }),
          },
        }),
      },
    }),
  )
  const mappedOwnedRelationshipSchema = printCmsPrismaSchema(
    mappedOwnedRelationshipLists,
  )
  assert(
    mappedOwnedRelationshipSchema.includes(
      'roleId String? @map("mapped_role_id")',
    ),
    'generated Prisma schema should keep owned relationship foreign keys with @map(...) when db.foreignKey.map is configured',
  )
  assert(
    mappedOwnedRelationshipSchema.includes(
      'role MappedRole? @relation(fields: [roleId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should keep owned relationship relation args including onUpdate when the related list is mapped',
  )
  assert(
    mappedOwnedRelationshipSchema.includes('members MappedUser[]'),
    'generated Prisma schema should keep the inverse to-many side when mapped lists participate in owned relationships',
  )
  assert(
    mappedOwnedRelationshipSchema.includes('@@map("mapped_roles")'),
    'generated Prisma schema should preserve mapped related-list @@map(...) when that mapped list participates in owned relationships',
  )
  assert(
    mappedOwnedRelationshipSchema.includes('@@map("mapped_users")'),
    'generated Prisma schema should preserve mapped source-list @@map(...) when that mapped list participates in owned relationships',
  )

  const mappedAutoincrementOwnedRelationshipLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        MappedCounterRole: list({
          db: { map: 'mapped_counter_roles' },
          fields: {
            members: relationship({
              ref: 'MappedCounterUser.role',
              many: true,
            }),
          },
        }),
        MappedCounterUser: list({
          db: { map: 'mapped_counter_users' },
          fields: {
            role: relationship({
              ref: 'MappedCounterRole.members',
              db: { foreignKey: { map: 'mapped_counter_role_id' } },
            }),
          },
        }),
      },
    }),
  )
  const mappedAutoincrementOwnedRelationshipSchema = printCmsPrismaSchema(
    mappedAutoincrementOwnedRelationshipLists,
  )
  assert(
    mappedAutoincrementOwnedRelationshipSchema.includes(
      'id Int @id @default(autoincrement())',
    ),
    'generated Prisma schema should preserve autoincrement id models when mapped lists participate in owned relationships',
  )
  assert(
    mappedAutoincrementOwnedRelationshipSchema.includes(
      'roleId Int? @map("mapped_counter_role_id")',
    ),
    'generated Prisma schema should keep Int owned relationship foreign keys with @map(...) when mapped autoincrement lists participate in owned relationships',
  )
  assert(
    mappedAutoincrementOwnedRelationshipSchema.includes(
      'role MappedCounterRole? @relation(fields: [roleId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should keep owned relationship relation args including onUpdate for mapped autoincrement lists',
  )
  assert(
    mappedAutoincrementOwnedRelationshipSchema.includes(
      'members MappedCounterUser[]',
    ),
    'generated Prisma schema should keep the inverse to-many side when mapped autoincrement lists participate in owned relationships',
  )
  assert(
    mappedAutoincrementOwnedRelationshipSchema.includes(
      '@@map("mapped_counter_roles")',
    ),
    'generated Prisma schema should preserve mapped related-list @@map(...) for mapped autoincrement owned relationships',
  )
  assert(
    mappedAutoincrementOwnedRelationshipSchema.includes(
      '@@map("mapped_counter_users")',
    ),
    'generated Prisma schema should preserve mapped source-list @@map(...) for mapped autoincrement owned relationships',
  )

  const autoincrementManyToManyLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        EventThing: list({
          fields: {
            counters: relationship({
              ref: 'CounterThing.events',
              many: true,
              db: { relationName: 'EventThingCounters' },
            }),
          },
        }),
        CounterThing: list({
          fields: {
            events: relationship({
              ref: 'EventThing.counters',
              many: true,
              db: { relationName: 'EventThingCounters' },
            }),
          },
        }),
      },
    }),
  )
  const autoincrementManyToManySchema = printCmsPrismaSchema(
    autoincrementManyToManyLists,
  )
  assert(
    autoincrementManyToManySchema.includes(
      'counters CounterThing[] @relation("EventThingCounters")',
    ),
    'generated Prisma schema should consume explicit many-to-many join metadata for autoincrement EventThing.counters',
  )
  assert(
    autoincrementManyToManySchema.includes(
      'events EventThing[] @relation("EventThingCounters")',
    ),
    'generated Prisma schema should consume explicit many-to-many join metadata for autoincrement CounterThing.events',
  )

  const mappedAutoincrementManyToManyLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        MappedCounterCategory: list({
          db: { map: 'mapped_counter_categories' },
          fields: {
            posts: relationship({
              ref: 'MappedCounterPost.categories',
              many: true,
              db: { relationName: 'MappedCounterPostCategories' },
            }),
          },
        }),
        MappedCounterPost: list({
          db: { map: 'mapped_counter_posts' },
          fields: {
            categories: relationship({
              ref: 'MappedCounterCategory.posts',
              many: true,
              db: { relationName: 'MappedCounterPostCategories' },
            }),
          },
        }),
      },
    }),
  )
  const mappedAutoincrementManyToManySchema = printCmsPrismaSchema(
    mappedAutoincrementManyToManyLists,
  )
  assert(
    mappedAutoincrementManyToManySchema.includes(
      'id Int @id @default(autoincrement())',
    ),
    'generated Prisma schema should preserve autoincrement id models when mapped lists participate in explicit many-to-many relations',
  )
  assert(
    mappedAutoincrementManyToManySchema.includes(
      'posts MappedCounterPost[] @relation("MappedCounterPostCategories")',
    ),
    'generated Prisma schema should preserve explicit many-to-many relation naming when mapped autoincrement related lists participate',
  )
  assert(
    mappedAutoincrementManyToManySchema.includes(
      'categories MappedCounterCategory[] @relation("MappedCounterPostCategories")',
    ),
    'generated Prisma schema should preserve explicit many-to-many relation naming when mapped autoincrement source lists participate',
  )
  assert(
    mappedAutoincrementManyToManySchema.includes(
      '@@map("mapped_counter_categories")',
    ),
    'generated Prisma schema should preserve mapped related-list @@map(...) when mapped autoincrement lists participate in explicit many-to-many relations',
  )
  assert(
    mappedAutoincrementManyToManySchema.includes(
      '@@map("mapped_counter_posts")',
    ),
    'generated Prisma schema should preserve mapped source-list @@map(...) when mapped autoincrement lists participate in explicit many-to-many relations',
  )

  const oneSidedLists = initialiseLists(
    config({
      lists: {
        Tag: list({
          fields: {
            name: text(),
          },
        }),
        Post: list({
          fields: {
            primaryTag: relationship({ ref: 'Tag' }),
            tags: relationship({ ref: 'Tag', many: true }),
            namedTags: relationship({
              ref: 'Tag',
              many: true,
              db: { relationName: 'PostNamedTags' },
            }),
          },
        }),
      },
    }),
  )
  const oneSidedSchema = printCmsPrismaSchema(oneSidedLists)
  assert(
    oneSidedSchema.includes('primaryTagId String?'),
    'generated Prisma schema should emit a foreign key column for one-sided single relationships',
  )
  assert(
    oneSidedSchema.includes(
      'primaryTag Tag? @relation(fields: [primaryTagId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should emit relation metadata including onUpdate for one-sided single relationships',
  )
  assert(
    oneSidedSchema.includes('tags Tag[]'),
    'generated Prisma schema should keep one-sided many relationships as to-many relation fields without inventing a local foreign key on the many side',
  )
  assert(
    oneSidedSchema.includes('namedTags Tag[] @relation("PostNamedTags")'),
    'generated Prisma schema should preserve explicit relationName metadata for one-sided named-many relationships without inventing a local foreign key on the many side',
  )

  const selfLists = initialiseLists(
    config({
      lists: {
        Category: list({
          fields: {
            title: text(),
            parent: relationship({ ref: 'Category.children' }),
            children: relationship({ ref: 'Category.parent', many: true }),
            mentor: relationship({ ref: 'Category' }),
            peers: relationship({ ref: 'Category', many: true }),
            namedPeers: relationship({
              ref: 'Category',
              many: true,
              db: { relationName: 'CategoryNamedPeers' },
            }),
          },
        }),
      },
    }),
  )
  const selfSchema = printCmsPrismaSchema(selfLists)
  assert(
    selfSchema.includes('parentId String?'),
    'generated Prisma schema should emit a foreign key column for self two-sided single-to-many relationships',
  )
  assert(
    selfSchema.includes(
      'parent Category? @relation(fields: [parentId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should emit relation metadata including onUpdate for self two-sided single-to-many relationships',
  )
  assert(
    selfSchema.includes('children Category[]'),
    'generated Prisma schema should keep the inverse to-many side for self two-sided relationships',
  )
  assert(
    selfSchema.includes('mentorId String?'),
    'generated Prisma schema should emit a foreign key column for self one-sided single relationships',
  )
  assert(
    selfSchema.includes(
      'mentor Category? @relation(fields: [mentorId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    ),
    'generated Prisma schema should emit relation metadata including onUpdate for self one-sided single relationships',
  )
  assert(
    selfSchema.includes('peers Category[]'),
    'generated Prisma schema should keep self one-sided many relationships as to-many relation fields without inventing a local foreign key on the many side',
  )
  assert(
    selfSchema.includes(
      'namedPeers Category[] @relation("CategoryNamedPeers")',
    ),
    'generated Prisma schema should preserve explicit relationName metadata for self one-sided named-many relationships without inventing a local foreign key on the many side',
  )

  console.info('CMS Prisma schema generation validation passed.')
}

main()
