const CHAINS = [
  { name: 'Jollibee', icon: '🍗', menu: 'https://order.jollibee.com/en/ph/menu',
    meals: ['Chickenjoy', 'Jolly Spaghetti', 'Yumburger'], treats: ['Peach Mango Pie'] },
  { name: "McDonald’s Philippines", icon: '🍔', menu: 'https://www.mcdelivery.com.ph/',
    meals: ['Chicken McDo', 'McSpaghetti', 'Burger McDo'], treats: ['Desserts'] },
  { name: 'Chowking', icon: '🥟', menu: 'https://www.chowking.ph/menu',
    meals: ['Chao Fan', 'Chinese-Style Fried Chicken', 'Siopao & Siomai'], treats: ['SuperSangkap Halo-Halo'] },
  { name: 'Mang Inasal', icon: '🍢', menu: 'https://www.manginasal.ph/menu',
    meals: ['Chicken Inasal', 'Pork BBQ', 'Palabok'], treats: ['Extra Creamy Halo-Halo', 'Crema de Leche Halo-Halo'] },
];
export default function FastFoodChoices({ mealType = 'Lunch' }) {
  const treats = mealType === 'Snack' || mealType === 'Dessert';
  return <section className="fast-food-choices" aria-label="Philippine fast-food alternatives">
    <h3>{treats ? 'Fast-food desserts and snacks' : `Fast-food alternatives for ${mealType.toLowerCase()}`}</h3>
    <p>Choose a Philippine chain in one tap. View your branch’s current price, nutrition and allergens on its official menu.</p>
    <div className="fast-food-grid">{CHAINS.map((chain) => <a className="fast-food-card" key={chain.name} href={chain.menu} target="_blank" rel="noreferrer">
      <span aria-hidden="true">{chain.icon}</span><strong>{chain.name}</strong>
      <span>{(treats ? chain.treats : chain.meals).join(' · ')}</span>
      <small>Branch price: check official menu</small><b>View menu →</b>
    </a>)}</div>
  </section>;
}
