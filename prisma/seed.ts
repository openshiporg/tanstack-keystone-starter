import 'dotenv/config'

import { hashPassword } from '../src/features/cms/auth/password'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'

const prisma = createCmsPrismaClient()

// Demo-only data. Keystone/NKS first-run behavior is createInitialUser, not this seed.
// Use `npm run db:reset:fresh` (without `db:seed:demo`) to test true admin initialization.

async function main() {
  await prisma.todoImage.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()

  const adminRole = await prisma.role.create({
    data: {
      id: 'role_admin',
      name: 'Administrator',
      canCreateTodos: true,
      canManageAllTodos: true,
      canSeeOtherPeople: true,
      canEditOtherPeople: true,
      canManagePeople: true,
      canManageRoles: true,
      canAccessDashboard: true,
    },
  })

  const editorRole = await prisma.role.create({
    data: {
      id: 'role_editor',
      name: 'Todo Editor',
      canCreateTodos: true,
      canManageAllTodos: false,
      canSeeOtherPeople: false,
      canEditOtherPeople: false,
      canManagePeople: false,
      canManageRoles: false,
      canAccessDashboard: true,
    },
  })

  const admin = await prisma.user.create({
    data: {
      id: 'user_admin',
      name: 'Ada Admin',
      email: 'ada@example.com',
      password: await hashPassword('password'),
      role: { connect: { id: adminRole.id } },
    },
  })

  const editor = await prisma.user.create({
    data: {
      id: 'user_editor',
      name: 'Ed Editor',
      email: 'ed@example.com',
      password: await hashPassword('password'),
      role: { connect: { id: editorRole.id } },
    },
  })

  const wireframe = await prisma.todoImage.create({
    data: {
      id: 'image_wireframe',
      image_id: 'wireframe',
      image_extension: 'png',
      image_filesize: 96000,
      image_width: 1024,
      image_height: 768,
      imagePath: '/images/todos/wireframe.png',
      altText: 'Wireframe sketch for the CMS todo screen',
      metadata: { dominantColor: '#94a3b8' },
    },
  })

  const dashboard = await prisma.todoImage.create({
    data: {
      id: 'image_dashboard',
      image_id: 'dashboard',
      image_extension: 'png',
      image_filesize: 188000,
      image_width: 1400,
      image_height: 900,
      imagePath: '/images/todos/dashboard.png',
      altText: 'Dashboard screenshot placeholder',
      metadata: { dominantColor: '#0f172a' },
    },
  })

  await prisma.todo.create({
    data: {
      id: 'todo_launch',
      label: 'Launch TanStack CMS parity slice',
      description: {
        document: [
          { type: 'paragraph', children: [{ text: 'Seeded Prisma todo.' }] },
        ],
      },
      isComplete: false,
      status: 'in_progress',
      priority: 2,
      tags: ['backend', 'feature'],
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
      weight: 3.5,
      budget: '1250.00',
      isPrivate: false,
      largeNumber: BigInt('9007199254740993'),
      metadata: { source: 'seed' },
      secretNote: await hashPassword('launch secret'),
      coverImage_id: 'cover_launch',
      coverImage_extension: 'png',
      coverImage_filesize: 148000,
      coverImage_width: 1200,
      coverImage_height: 630,
      assignedTo: { connect: { id: admin.id } },
      todoImages: { connect: [{ id: wireframe.id }, { id: dashboard.id }] },
    },
  })

  await prisma.todo.create({
    data: {
      id: 'todo_docs',
      label: 'Document GraphQL CRUD behavior',
      isComplete: false,
      status: 'todo',
      priority: 3,
      tags: ['documentation'],
      weight: 1,
      budget: '0.00',
      isPrivate: false,
      metadata: { audience: 'developers' },
      secretNote: null,
      assignedTo: { connect: { id: editor.id } },
      todoImages: { connect: [{ id: dashboard.id }] },
    },
  })

  await prisma.todo.create({
    data: {
      id: 'todo_private',
      label: 'Private admin-only planning',
      isComplete: false,
      status: 'blocked',
      priority: 5,
      tags: ['urgent'],
      weight: 1,
      budget: '0.00',
      isPrivate: true,
      secretNote: await hashPassword('private secret'),
      assignedTo: { connect: { id: admin.id } },
    },
  })

  console.info('Seeded Prisma CMS demo data.')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
