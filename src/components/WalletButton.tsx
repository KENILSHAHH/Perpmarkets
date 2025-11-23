"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState, useEffect } from "react";

export default function WalletButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !ready) {
    return (
      <div className="px-4 py-2 bg-gray-200 rounded-lg animate-pulse">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={logout}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          Disconnect
        </button>
      </div>
      
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          User Info
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">ID:</span> {user?.id}
          </p>
          {user?.email && (
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Email:</span> {user.email.address}
            </p>
          )}
          {user?.wallet && (
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Wallet:</span>{" "}
              {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
            </p>
          )}
        </div>
      </div>

      {wallets.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Connected Wallets ({wallets.length})
          </h3>
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.address}
                className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              >
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {wallet.address}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {wallet.walletClientType} • {wallet.chainId}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

