const axios = require('axios');

// M-Pesa STK Push integration for Safaricom Daraja API
class MpesaService {
    constructor(config) {
        this.consumerKey = config.consumerKey || '';
        this.consumerSecret = config.consumerSecret || '';
        this.shortcode = config.shortcode || '174379'; // Sandbox shortcode
        this.passkey = config.passkey || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'; // Sandbox passkey
        this.environment = config.environment || 'sandbox';
        this.baseUrl = this.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
        this.callbackUrl = config.callbackUrl || 'https://example.com/mpesa/callback';
    }

    async getAccessToken() {
        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        try {
            const response = await axios.get(
                `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
                { headers: { Authorization: `Basic ${auth}` } }
            );
            return response.data.access_token;
        } catch (error) {
            console.error('M-Pesa auth error:', error.message);
            throw new Error('Failed to authenticate with M-Pesa');
        }
    }

    generateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    generatePassword(timestamp) {
        return Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    }

    async stkPush(phoneNumber, amount, accountRef = 'GloryPharmacy', description = 'Payment') {
        // Format phone number (convert 0xxx to 254xxx)
        let formattedPhone = phoneNumber.replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.substring(1);
        }

        const timestamp = this.generateTimestamp();
        const password = this.generatePassword(timestamp);

        try {
            const token = await this.getAccessToken();
            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                {
                    BusinessShortCode: this.shortcode,
                    Password: password,
                    Timestamp: timestamp,
                    TransactionType: 'CustomerPayBillOnline',
                    Amount: Math.ceil(amount),
                    PartyA: formattedPhone,
                    PartyB: this.shortcode,
                    PhoneNumber: formattedPhone,
                    CallBackURL: this.callbackUrl,
                    AccountReference: accountRef,
                    TransactionDesc: description,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error('STK Push error:', error.response?.data || error.message);
            throw new Error('Failed to initiate M-Pesa payment');
        }
    }

    async queryStatus(checkoutRequestId) {
        const timestamp = this.generateTimestamp();
        const password = this.generatePassword(timestamp);

        try {
            const token = await this.getAccessToken();
            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
                {
                    BusinessShortCode: this.shortcode,
                    Password: password,
                    Timestamp: timestamp,
                    CheckoutRequestID: checkoutRequestId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error('Query status error:', error.response?.data || error.message);
            throw new Error('Failed to query M-Pesa payment status');
        }
    }

    // Simulate STK push for testing without real credentials
    simulateStkPush(phoneNumber, amount) {
        return {
            MerchantRequestID: 'SIM-' + Date.now(),
            CheckoutRequestID: 'ws_CO_SIM_' + Date.now(),
            ResponseCode: '0',
            ResponseDescription: 'Success. Request accepted for processing (SIMULATED)',
            CustomerMessage: `Sim STK sent to ${phoneNumber} for KES ${amount}`,
        };
    }

    simulateQueryStatus() {
        return {
            ResponseCode: '0',
            ResultCode: '0',
            ResultDesc: 'The service request is processed successfully. (SIMULATED)',
        };
    }
}

module.exports = MpesaService;
