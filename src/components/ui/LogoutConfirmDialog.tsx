'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';

interface LogoutConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function LogoutConfirmDialog({ open, onConfirm, onCancel, loading }: LogoutConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <LogOut className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <DialogHeader>
                <DialogTitle className="text-white text-base font-bold">Sign Out</DialogTitle>
                <DialogDescription className="text-emerald-50 text-xs mt-0.5">
                  Are you sure you want to sign out?
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3 bg-white">
          <p className="text-sm text-slate-600">
            You'll be logged out of your account and redirected to the login page.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <LogOut className="h-4 w-4 mr-1" />
              )}
              Sign Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
