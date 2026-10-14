import { useIngredientPrices } from '../context/PriceContext';
import { formatPrice } from '../lib/pricing';
import IngredientPriceCatalogue from './IngredientPriceCatalogue';
import '../styles/prices.css';

export default function PriceSourceStatus({ showCatalog = false }) {
  const { records, loading, report, warning, refresh, lastCheckedAt } = useIngredientPrices();
  const reference = records.filter((p) => p.kind === 'reference');
  const official = reference.filter((p) => p.sourceType !== 'retailer');
  const retail = reference.filter((p) => p.sourceType === 'retailer');
  const stale = report && Date.now() - new Date(report.observedAt).getTime() > 14 * 86400000;
  return <div className="price-source">
    <div className="price-source-row">
      <div role="status"><strong>Ingredient prices · Verified sources</strong>
        <p>{official.length} DA reference prices · {retail.length} retailer reference prices · {report?.label}</p>
      </div>
      <button type="button" disabled={loading} onClick={() => refresh({ force: true })}>{loading ? 'Checking prices…' : 'Check prices now'}</button>
    </div>
    <p>Auto-checks every 15 seconds while this page is active. Retailer checks are shared for 30 seconds; the button requests a fresh check. Suppliers do not send instant change notifications.</p>
    {lastCheckedAt && <p>Last source check: {new Date(lastCheckedAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })}</p>}
    <p>DA NCR averages and Philippine store listings are reference estimates. Jelexie is a Tarlac brand; other listings are not confirmed Tarlac market quotes.</p>
    <p>Cooked foods may use labeled raw-ingredient estimates. Base-only subtotals exclude extra ingredients and are not complete meal costs.</p>
    <p>Liquid household measures use 240 ml per cup, 15 ml per tablespoon and 5 ml per teaspoon. Approximate quantities are labeled; “scant” uses the stated full measure as an upper estimate.</p>
    <p>Rare ingredients may use comparable Philippine product benchmarks for budgeting. These are labeled estimates, not exact prices for the requested species or cut; open the ingredients to see each comparison.</p>
    <p>Prices use Philippine DA reports and Philippine store listings in pesos only. Unsupported assumptions are excluded from affordability results. Carrot, cabbage, squash and sitaw use labeled DOST-FNRI purchase/edible portion references; other cooked-food conversions still need documented evidence.</p>
    {warning && <p className="price-warning">{warning}</p>}
    {stale && <p className="price-warning">This report is over 14 days old. Check current prices before shopping.</p>}
    {report && <a href={report.url} target="_blank" rel="noreferrer">View official DA report</a>}
    {showCatalog && <IngredientPriceCatalogue />}
    {showCatalog && <details className="price-catalog"><summary>View ingredient reference prices ({reference.length})</summary>
      <div className="price-table-wrap"><table><thead><tr><th>Ingredient</th><th>Price / unit</th><th>Region / date</th></tr></thead>
        <tbody>{reference.map((p) => <tr key={`${p.key}-${p.sourceUrl}`}><td><a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.name}</a><div className="price-estimate-note">{p.description}<br />{p.notes} {p.availability}</div></td><td>{formatPrice(p.price)} / {p.unit}{p.packPrice && <div className="price-estimate-note">{formatPrice(p.packPrice)} / {p.packQuantity}</div>}</td><td>{p.region} · {p.observedAt}</td></tr>)}</tbody>
      </table></div>
    </details>}
  </div>;
}
