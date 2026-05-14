import { NextRequest, NextResponse } from 'next/server';
import { fcmService } from '@/lib/fcm-service';
import { verifyApiAuth } from '@/lib/api-auth';

interface RegisterDeviceRequest {
  userId: string;
  deviceToken: string;
  userAgent?: string;
  userType?: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants';
  isNewUser?: boolean;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX C6: Verify caller identity with Firebase Admin SDK
    const caller = await verifyApiAuth(request);
    // Best-effort: allow registration even if auth fails (for first-time PWA users)
    // but verify identity match when auth IS available
    
    const body: RegisterDeviceRequest = await request.json();
    const { 
      userId, 
      deviceToken, 
      userAgent, 
      userType = 'retailers', 
      isNewUser = true, 
      timestamp 
    } = body;

    console.log('📱 FCM API: Received device registration request:', {
      userId,
      userType,
      tokenLength: deviceToken?.length || 0,
      isNewUser,
      hasAuth: !!caller
    });

    if (!userId || !deviceToken) {
      console.error('❌ FCM API: Missing required fields:', { userId: !!userId, deviceToken: !!deviceToken });
      return NextResponse.json(
        { error: 'Missing required fields: userId, deviceToken' },
        { status: 400 }
      );
    }

    // SECURITY FIX C6: If auth is verified, ensure userId matches the caller
    // For 'tenants' userType, allow if caller's custom claims include matching tenantId
    const isTenantScoped = userType === 'tenants';
    const callerTenantId = caller?.tenantId;
    const isOwner = !caller || userId === caller.uid || (isTenantScoped && callerTenantId === userId);
    if (!isOwner) {
      console.warn(`⚠️ FCM register: Token user ${caller!.uid} != requested userId ${userId}`);
      return NextResponse.json(
        { error: 'Cannot register devices for another user' },
        { status: 403 }
      );
    }

    // NOTE: User existence and active status checks are now handled inside
    // fcmService.registerDevice() using the Admin SDK, avoiding a duplicate
    // Firestore read per registration call.

    console.log(`📱 Registering device for ${isNewUser ? 'new' : 'returning'} ${userType}:`, {
      userId,
      userAgent: userAgent?.substring(0, 50) + '...',
      timestamp: timestamp || new Date().toISOString()
    });

    // Check if FCM is properly configured
    if (!fcmService.isConfigured()) {
      console.error('❌ FCM API: FCM service is not properly configured');
      return NextResponse.json(
        { error: 'FCM service is not properly configured' },
        { status: 500 }
      );
    }

    console.log('✅ FCM API: FCM service configured, calling registerDevice...');
    const result = await fcmService.registerDevice(userId, deviceToken, userAgent, userType);

    console.log('🔧 FCM API: Service returned result:', result);

    if (result.success) {
      console.log(`✅ Device registered successfully for ${isNewUser ? 'new' : 'returning'} ${userType}:`, userId);
      return NextResponse.json({
        success: true,
        message: result.message,
        userType,
        isNewUser,
        timestamp: timestamp || new Date().toISOString()
      });
    } else {
      console.warn(`⚠️ Device registration failed for ${isNewUser ? 'new' : 'returning'} ${userType}:`, result.message);
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ Error in FCM register-device API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}