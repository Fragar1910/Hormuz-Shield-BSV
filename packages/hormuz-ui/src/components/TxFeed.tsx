import type { TxEvent } from '../types';

interface TxFeedProps {
  transactions: TxEvent[];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function TxFeed({ transactions }: TxFeedProps) {
  return (
    <section className="tx-feed">
      <div className="panel-title">
        <h2>Recent Transactions</h2>
      </div>
      <div className="tx-table">
        {transactions.slice(0, 14).map((tx) => (
          <article key={tx.id} className="tx-row">
            <div>{tx.type}</div>
            <div>{tx.amount.toLocaleString()} sats</div>
            <div>
              {tx.from} -&gt; {tx.to}
            </div>
            <div>{formatTime(tx.timestamp)}</div>
            <div>
              {tx.txid ? (
                <a href={`https://whatsonchain.com/tx/${tx.txid}`} target="_blank" rel="noreferrer">
                  txid
                </a>
              ) : (
                'n/a'
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
