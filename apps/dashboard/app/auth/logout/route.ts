import { NextResponse } from "next/server";
import { clearWumpusSession } from "../../../lib/auth";

export async function POST(request: Request) {
  await clearWumpusSession();
  return NextResponse.redirect(new URL("/wumpus", request.url), 303);
}
