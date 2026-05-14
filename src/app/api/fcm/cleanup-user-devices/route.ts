import { NextRequest, NextResponse } from 'next/server';
import { fcmService } from '@/lib/fcm-service';
import { verifyApiAuth } from '@/lib/api-auth';

interface CleanupUserDevicesRequest {
  userId: string;
  userType?: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants';
  markAllInactive?: boolean; // New option to mark all devices as inactive
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX C4: Require authentication — user can only clean up their own devices
    const caller = await verifyApiAuth(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CleanupUserDevicesRequest = await request.json();
    const { userId, userType = 'retailers', markAllInactive = false } = body;

    // SECURITY: Caller can only clean up their own devices
    // For 'tenants' userType, allow if caller's custom claims include matching tenantId
    const isTenantScoped = userType === 'tenants';
    const isOwner = userId === caller.uid || (isTenantScoped && caller.tenantId === userId);
    if (!isOwner) {
      console.warn(`⚠️ FCM cleanup: User ${caller.uid} attempted to clean devices for ${userId}`);
      return NextResponse.json({ error: 'Can only clean up your own devices' }, { status: 403 });
    }

    console.log('🧹 FCM API: Received cleanup user devices request:', {
      userId,
      userType,
      markAllInactive
    });

    if (!userId) {
      console.error('❌ FCM API: Missing required field: userId');
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    if (markAllInactive) {
      // Mark all devices as inactive (for logout)
      // FIX M11: Use Admin SDK instead of client Firestore SDK in server-side route
      console.log(`🔐 Marking all devices as inactive for ${userType}:`, userId);
      
      try {
        const { getFirebaseFirestore } = await import('@/lib/firebase-admin');
        const adminDb = getFirebaseFirestore();
        const userRef = adminDb.collection(userType).doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          console.log(`⚠️ User document not found for ${userType}:`, userId);
          return NextResponse.json({
            success: true,
            message: 'User document not found',
            cleanedCount: 0
          });
        }
        
        const userData = userDoc.data();
        const allDevices: any[] = userData?.fcmDevices || [];
        
        if (allDevices.length === 0) {
          console.log('✅ No devices to mark inactive for user:', userId);
          return NextResponse.json({
            success: true,
            message: 'No devices found to mark inactive',
            cleanedCount: 0
          });
        }
        
        // Mark all devices as inactive using Admin SDK
        const updatedDevices = allDevices.map(device => ({
          ...device,
          isActive: false,
          lastActive: new Date()
        }));
        
        await userRef.update({
          fcmDevices: updatedDevices,
          updatedAt: new Date()
        });
        
        console.log(`✅ Marked ${updatedDevices.length} devices as inactive for ${userType}:`, userId);
        
        return NextResponse.json({
          success: true,
          message: `Successfully marked ${updatedDevices.length} device(s) as inactive`,
          cleanedCount: updatedDevices.length,
          totalDevices: allDevices.length,
          userType
        });
        
      } catch (error) {
        console.error(`❌ Error marking devices inactive for ${userType}:`, error);
        return NextResponse.json(
          { error: 'Failed to mark devices as inactive' },
          { status: 500 }
        );
      }
    } else {
      // Original behavior: Clean up active devices only
      const devices = await fcmService.getActiveDevices(userId, userType);
      console.log(`📱 Found ${devices.length} devices for ${userType}:`, userId);

      if (devices.length === 0) {
        console.log('✅ No devices to cleanup for user:', userId);
        return NextResponse.json({
          success: true,
          message: 'No devices found to cleanup',
          cleanedCount: 0
        });
      }

      // Remove all devices for this user
      let cleanedCount = 0;
      for (const device of devices) {
        try {
          const result = await fcmService.unregisterDevice(userId, device.token, userType);
          if (result.success) {
            cleanedCount++;
            console.log(`✅ Cleaned device: ${device.token.substring(0, 20)}...`);
          } else {
            console.warn(`⚠️ Failed to clean device: ${device.token.substring(0, 20)}...`);
          }
        } catch (error) {
          console.error(`❌ Error cleaning device ${device.token.substring(0, 20)}...:`, error);
        }
      }

      console.log(`✅ Cleanup completed for ${userType} ${userId}. Cleaned ${cleanedCount}/${devices.length} devices`);

      return NextResponse.json({
        success: true,
        message: `Successfully cleaned ${cleanedCount} device(s)`,
        cleanedCount,
        totalDevices: devices.length,
        userType
      });
    }

  } catch (error) {
    console.error('❌ Error in FCM cleanup-user-devices API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}