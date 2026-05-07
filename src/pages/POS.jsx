import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiTrash2, FiPlus, FiMinus, FiPrinter } from 'react-icons/fi';

export default function POS() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [processing, setProcessing] = useState(false);
    const [receipt, setReceipt] = useState(null);
    const searchRef = useRef(null);

    useEffect(() => {
        if (search.length >= 2) {
            axios.get(`/api/pos/search?q=${search}`).then(r => setProducts(r.data));
        } else {
            setProducts([]);
        }
    }, [search]);

    useEffect(() => { searchRef.current?.focus(); }, []);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            if (existing) {
                if (existing.quantity >= product.available_stock) {
                    toast.error('Not enough stock');
                    return prev;
                }
                return prev.map(item =>
                    item.product_id === product.id
                        ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
                        : item
                );
            }
            return [...prev, {
                product_id: product.id,
                name: product.name,
                strength: product.strength,
                dosage_form: product.dosage_form,
                price: product.price,
                quantity: 1,
                subtotal: product.price,
                max_stock: product.available_stock,
            }];
        });
        setSearch('');
        searchRef.current?.focus();
    };

    const updateQty = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.product_id !== productId) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.max_stock) { toast.error('Not enough stock'); return item; }
            return { ...item, quantity: newQty, subtotal: newQty * item.price };
        }).filter(Boolean));
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product_id !== productId));
    };

    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

    const processSale = async () => {
        if (!cart.length) return toast.error('Cart is empty');
        setProcessing(true);

        try {
            if (paymentMethod === 'mpesa') {
                if (!mpesaPhone) { toast.error('Enter customer phone number'); setProcessing(false); return; }
                const stkRes = await axios.post('/api/pos/mpesa-stk', { phone: mpesaPhone, amount: total });
                toast.success(stkRes.data.CustomerMessage || 'M-Pesa prompt sent!');
            }

            const saleRes = await axios.post('/api/pos/sale', {
                items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
                payment_method: paymentMethod,
                mpesa_phone: paymentMethod === 'mpesa' ? mpesaPhone : null,
            });

            const receiptRes = await axios.get(`/api/pos/receipt/${saleRes.data.sale_id}`);
            setReceipt(receiptRes.data);
            setCart([]);
            setShowPayment(false);
            toast.success(`Sale completed! Total: KES ${total.toLocaleString()}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Sale failed');
        } finally {
            setProcessing(false);
        }
    };

    const printReceipt = () => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`
      <html><head><title>Receipt</title>
      <style>body{font-family:'Courier New',monospace;font-size:12px;margin:20px;max-width:300px;}
      .center{text-align:center;}.divider{border-top:1px dashed #000;margin:8px 0;}
      table{width:100%;} td{padding:2px 0;} .right{text-align:right;} .bold{font-weight:bold;}</style></head>
      <body>
      <div class="center"><h2>${receipt.pharmacy_name}</h2><p>${receipt.pharmacy_location}</p></div>
      <div class="divider"></div>
      <p>Receipt: ${receipt.transaction_id}<br/>Date: ${new Date(receipt.created_at).toLocaleString()}<br/>Cashier: ${receipt.cashier_name}</p>
      <div class="divider"></div>
      <table>${receipt.items.map(item => `<tr><td>${item.product_name}</td><td class="right">${item.quantity} x ${item.unit_price}</td><td class="right">${item.subtotal}</td></tr>`).join('')}</table>
      <div class="divider"></div>
      <table><tr class="bold"><td>TOTAL</td><td class="right">KES ${receipt.total_amount.toLocaleString()}</td></tr>
      <tr><td>Payment</td><td class="right">${receipt.payment_method.toUpperCase()}</td></tr></table>
      <div class="divider"></div>
      <div class="center"><p>Thank you for choosing Glory Pharmacy!</p><p>Get well soon 💊</p></div>
      </body></html>
    `);
        printWindow.document.close();
        printWindow.print();
    };

    const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

    return (
        <>
            <div className="page-header">
                <div><h1>Point of Sale</h1><p>Process pharmacy sales quickly</p></div>
            </div>
            <div className="page-body">
                <div className="pos-layout">
                    {/* Products panel */}
                    <div className="pos-products">
                        <div className="pos-search">
                            <FiSearch className="search-icon" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search medicines by name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {products.length > 0 ? (
                            <div className="pos-product-grid">
                                {products.map(p => (
                                    <div key={p.id} className="pos-product-card" onClick={() => addToCart(p)}>
                                        <div className="name">{p.name}</div>
                                        <div className="details">{p.dosage_form} {p.strength && `• ${p.strength}`} • {p.category}</div>
                                        <div className="price">KES {fmt(p.price)}</div>
                                        <div className="stock">{p.available_stock} in stock</div>
                                    </div>
                                ))}
                            </div>
                        ) : search.length >= 2 ? (
                            <div className="empty-state"><div className="icon">🔍</div><h3>No products found</h3><p>Try a different search term</p></div>
                        ) : (
                            <div className="empty-state"><div className="icon">💊</div><h3>Search for medicines</h3><p>Type at least 2 characters to search</p></div>
                        )}
                    </div>

                    {/* Cart panel */}
                    <div className="pos-cart">
                        <div className="pos-cart-header">
                            <h3>🛒 Cart ({cart.length})</h3>
                            {cart.length > 0 && (
                                <button className="btn btn-sm btn-secondary" onClick={() => setCart([])}>Clear</button>
                            )}
                        </div>

                        <div className="pos-cart-items">
                            {cart.length === 0 ? (
                                <div className="empty-state" style={{ padding: 30 }}><div className="icon">🛒</div><p>Cart is empty</p></div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.product_id} className="pos-cart-item">
                                        <div className="item-info">
                                            <div className="item-name">{item.name}</div>
                                            <div className="item-price">KES {fmt(item.price)} each</div>
                                        </div>
                                        <div className="qty-control">
                                            <button className="qty-btn" onClick={() => updateQty(item.product_id, -1)}>−</button>
                                            <span className="qty-val">{item.quantity}</span>
                                            <button className="qty-btn" onClick={() => updateQty(item.product_id, 1)}>+</button>
                                        </div>
                                        <div className="item-subtotal">KES {fmt(item.subtotal)}</div>
                                        <button className="remove-btn" onClick={() => removeFromCart(item.product_id)}>
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pos-cart-footer">
                            <div className="pos-total">
                                <span className="label">Total</span>
                                <span className="amount">KES {fmt(total)}</span>
                            </div>
                            <button
                                className="btn btn-primary btn-lg btn-block"
                                disabled={!cart.length}
                                onClick={() => setShowPayment(true)}
                            >
                                Proceed to Payment
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {showPayment && (
                <div className="modal-overlay" onClick={() => setShowPayment(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Payment — KES {fmt(total)}</h3>
                            <button className="modal-close" onClick={() => setShowPayment(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="payment-methods">
                                <button
                                    className={`payment-method-btn ${paymentMethod === 'cash' ? 'selected' : ''}`}
                                    onClick={() => setPaymentMethod('cash')}
                                >
                                    <div className="icon">💵</div>
                                    <div className="label">Cash</div>
                                </button>
                                <button
                                    className={`payment-method-btn ${paymentMethod === 'mpesa' ? 'selected' : ''}`}
                                    onClick={() => setPaymentMethod('mpesa')}
                                >
                                    <div className="icon">📱</div>
                                    <div className="label">M-Pesa</div>
                                </button>
                            </div>

                            {paymentMethod === 'mpesa' && (
                                <div className="form-group">
                                    <label>Customer Phone Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., 0712345678"
                                        value={mpesaPhone}
                                        onChange={(e) => setMpesaPhone(e.target.value)}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Customer will receive an M-Pesa prompt to enter PIN
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPayment(false)}>Cancel</button>
                            <button className="btn btn-primary" disabled={processing} onClick={processSale}>
                                {processing ? 'Processing...' : `Complete Sale — KES ${fmt(total)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {receipt && (
                <div className="modal-overlay receipt-modal" onClick={() => setReceipt(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Receipt</h3>
                            <button className="modal-close" onClick={() => setReceipt(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="receipt">
                                <div className="receipt-header">
                                    <h3>{receipt.pharmacy_name}</h3>
                                    <p>{receipt.pharmacy_location}</p>
                                </div>
                                <div className="receipt-divider"></div>
                                <p><strong>Receipt #:</strong> {receipt.transaction_id}</p>
                                <p><strong>Date:</strong> {new Date(receipt.created_at).toLocaleString()}</p>
                                <p><strong>Cashier:</strong> {receipt.cashier_name}</p>
                                <div className="receipt-divider"></div>
                                <div className="receipt-items">
                                    <table>
                                        <thead><tr><td><strong>Item</strong></td><td><strong>Qty</strong></td><td style={{ textAlign: 'right' }}><strong>Amount</strong></td></tr></thead>
                                        <tbody>
                                            {receipt.items.map((item, i) => (
                                                <tr key={i}><td>{item.product_name}</td><td>{item.quantity}</td><td style={{ textAlign: 'right' }}>KES {fmt(item.subtotal)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="receipt-divider"></div>
                                <p className="receipt-total" style={{ textAlign: 'right', fontSize: '1rem' }}>
                                    TOTAL: KES {fmt(receipt.total_amount)}
                                </p>
                                <p style={{ textAlign: 'right', fontSize: '0.75rem' }}>Payment: {receipt.payment_method.toUpperCase()}</p>
                                <div className="receipt-divider"></div>
                                <p style={{ textAlign: 'center', fontSize: '0.75rem' }}>Thank you for choosing Glory Pharmacy! 💊</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setReceipt(null)}>Close</button>
                            <button className="btn btn-primary" onClick={printReceipt}><FiPrinter /> Print Receipt</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
