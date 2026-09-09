const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create categories
  const categories = ["Hardware", "Software", "Network", "Account", "Other"];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Categories seeded");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@helpdesk.local" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@helpdesk.local",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Create technician user
  const techPassword = await bcrypt.hash("tech123", 10);
  await prisma.user.upsert({
    where: { email: "technician@helpdesk.local" },
    update: {},
    create: {
      name: "IT Technician",
      email: "technician@helpdesk.local",
      password: techPassword,
      role: "TECHNICIAN",
    },
  });

  // Create student user
  const studentPassword = await bcrypt.hash("student123", 10);
  await prisma.user.upsert({
    where: { email: "student@helpdesk.local" },
    update: {},
    create: {
      name: "Test Student",
      email: "student@helpdesk.local",
      password: studentPassword,
      role: "STUDENT",
    },
  });

  // Create faculty user
  const facultyPassword = await bcrypt.hash("faculty123", 10);
  await prisma.user.upsert({
    where: { email: "faculty@helpdesk.local" },
    update: {},
    create: {
      name: "Test Faculty",
      email: "faculty@helpdesk.local",
      password: facultyPassword,
      role: "FACULTY",
    },
  });

  console.log("Users seeded");
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
