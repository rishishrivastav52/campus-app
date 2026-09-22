import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const student = await prisma.user.upsert({
    where: { email: "student@college.edu" },
    update: {},
    create: { name: "Sam Student", email: "student@college.edu", password, role: "STUDENT" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@college.edu" },
    update: {},
    create: { name: "Alex Admin", email: "admin@college.edu", password, role: "ADMIN" },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@college.edu" },
    update: {},
    create: { name: "Sasha Staff", email: "staff@college.edu", password, role: "STAFF" },
  });

  await prisma.issue.createMany({
    data: [
      {
        title: "Broken AC in Room 204",
        description: "The air conditioner has been leaking water onto the floor.",
        location: "Block A, Room 204",
        reportedById: student.id,
        status: "PENDING",
      },
      {
        title: "Wi-Fi down in Library",
        description: "No internet connectivity in the second floor reading area.",
        location: "Central Library, Floor 2",
        reportedById: student.id,
        assignedToId: staff.id,
        status: "ASSIGNED",
      },
    ],
  });

  await prisma.resource.createMany({
    data: [
      { name: "Projector - Epson EB-X05", type: "Electronics", location: "Store Room B", quantity: 4, condition: "GOOD" },
      { name: "Foldable Chairs", type: "Furniture", location: "Auditorium Store", quantity: 120, condition: "FAIR" },
    ],
  });

  console.log("Seed complete:", { student: student.email, admin: admin.email, staff: staff.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
