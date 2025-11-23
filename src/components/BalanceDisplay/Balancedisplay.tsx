// CHAPTER 4: Balance display component
import styles from './BalanceDisplay.module.css';

interface BalanceDisplayProps {
    balance: string | null;
    symbol: string;
}

export function BalanceDisplay({ balance, symbol }: BalanceDisplayProps) {
    // CHAPTER 4: Format balance for display
    let formattedBalance: string;
    if (balance === null || balance === undefined) {
        formattedBalance = '0.00';
    } else if (balance === 'Loading...') {
        formattedBalance = 'Loading...';
    } else {
        const numBalance = parseFloat(balance);
        formattedBalance = isNaN(numBalance) ? '0.00' : numBalance.toFixed(2);
    }

    return (
        <div className={styles.balanceContainer}>
            <span className={styles.balanceAmount}>{formattedBalance}</span>
            {formattedBalance !== 'Loading...' && (
                <span className={styles.balanceSymbol}>{symbol}</span>
            )}
        </div>
    );
}
