import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";

export async function GET() {
  try {
    const user = await getOrCreateUser();

    return NextResponse.json({
      success: true,
      message: "Clerk + Database connection working!",
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Database/Clerk error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not connect Clerk user to database",
      },
      { status: 500 }
    );
  }
}