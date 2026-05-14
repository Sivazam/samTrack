import { NextRequest, NextResponse } from 'next/server';
import { fcmService } from '@/lib/fcm-service';
import { verifyApiAuth } from '@/lib/api-auth';

interface UnregisterDeviceRequest {
  userId: string;
  deviceToken: string;
  userType?: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants';
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX C5: Require authentication — user can only unregister their own devices
    const caller = await verifyApiAuth(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UnregisterDeviceRequest = await request.json();
    const { userId, deviceToken, userType = 'retailers' } = body;

    // SECURITY: Caller can only unregister their own devices
    // For 'tenants' userType, allow if caller's custom claims include matching tenantId
    const isTenantScoped = userType === 'tenants';
    const isOwner = userId === caller.uid || (isTenantScoped && caller.tenantId === userId);
    if (!isOwner) {
      console.warn(`⚠️ FCM unregister: User ${caller.uid} attempted to unregister device for ${userId}`);
      return NextResponse.json({ error: 'Can only unregister your own devices' }, { status: 403 });
    }

    console.log('📱 FCM API: Received device unregistration request:', {
      userId,
      userType,
      tokenLength: deviceToken?.length || 0,
      tokenPrefix: deviceToken?.substring(0, 20) + '...'
    });

    if (!userId || !deviceToken) {
      console.error('❌ FCM API: Missing required fields:', { userId: !!userId, deviceToken: !!deviceToken });
      return NextResponse.json(
        { error: 'Missing required fields: userId, deviceToken' },
        { status: 400 }
      );
    }

    // Check if FCM is properly configured
    if (!fcmService.isConfigured()) {
      console.error('❌ FCM API: FCM service is not properly configured');
      return NextResponse.json(
        { error: 'FCM service is not properly configured' },
        { status: 500 }
      );
    }

    console.log('🗑️ Unregistering device for user:', {
      userId,
      userType
    });

    const result = await fcmService.unregisterDevice(userId, deviceToken, userType);

    console.log('🔧 FCM API: Unregister service returned result:', result);

    if (result.success) {
      console.log('✅ Device unregistered successfully:', userId);
      return NextResponse.json({
        success: true,
        message: result.message,
        userType
      });
    } else {
      console.warn('⚠️ Device unregistration failed:', result.message);
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ Error in FCM unregister-device API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}