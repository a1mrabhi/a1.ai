import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getOrCreateUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("User is not authenticated");
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("Authenticated user does not have an email");
  }

  const user = await prisma.user.upsert({
    where: {
      clerkId: clerkUser.id,
    },
    update: {
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(" ") || null,
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(" ") || null,
      imageUrl: clerkUser.imageUrl,
    },
  });

  return user;
}