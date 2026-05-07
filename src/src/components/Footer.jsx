import { FiMapPin, FiPhone, FiMail } from 'react-icons/fi';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-main">
                    <p className="powered-by">Powered by <span>Silent Stride Network LTD</span></p>
                    <p className="copyright">© {year} Silent Stride Network. All Rights Reserved.</p>
                </div>
                <div className="footer-contact">
                    <div className="contact-item">
                        <FiMapPin className="icon" />
                        <span>Hola, Tana River County, Kenya</span>
                    </div>
                    <div className="contact-item">
                        <FiPhone className="icon" />
                        <span>+254 713 376 418</span>
                    </div>
                    <div className="contact-item">
                        <FiMail className="icon" />
                        <span>support@silentstride.online</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
