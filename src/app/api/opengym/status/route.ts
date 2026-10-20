import { NextResponse } from "next/server";
import {
  checkOpenGymHealth,
  getOpenGymLocalState,
} from "@/lib/opengym-client";

export async function GET() {
  try {
    const health = await checkOpenGymHealth();
    const localState = await getOpenGymLocalState();

    const workoutCount = localState?.workouts?.length || 0;
    const weightCount = localState?.bodyWeight?.length || 0;

    return NextResponse.json({
      ...health,
      localStateFound: !!localState,
      stats: {
        workoutCount,
        weightCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { isOnline: false, error: error.message },
      { status: 500 }
    );
  }
}
