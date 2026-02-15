(function () {
    const root = document.getElementById('lucky-wheel-root');
    if (!root) return;

    const shop = root.dataset.shop;
    const proxyUrl = root.dataset.proxyUrl;
    const overlay = document.getElementById('lucky-wheel-overlay');
    const closeBtn = document.getElementById('lucky-wheel-close');
    const spinBtn = document.getElementById('lucky-wheel-spin-btn');
    const canvas = document.getElementById('wheel-canvas');
    const ctx = canvas.getContext('2d');

    let wheelConfig = null;
    let isSpinning = false;

    async function initWheel() {
        try {
            const response = await fetch(`${proxyUrl}/active-wheel?shop=${shop}`);
            const data = await response.json();

            if (data && data.wheel) {
                wheelConfig = data.wheel;
                drawWheel();
                // Show after a delay for testing
                setTimeout(() => {
                    overlay.style.display = 'flex';
                }, 3000);
            }
        } catch (e) {
            console.error('Failed to load lucky wheel:', e);
        }
    }

    function drawWheel() {
        const segments = wheelConfig.segments;
        const numSegments = segments.length;
        const arcSize = (2 * Math.PI) / numSegments;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        segments.forEach((segment, i) => {
            const angle = i * arcSize;
            ctx.beginPath();
            ctx.fillStyle = segment.color || (i % 2 === 0 ? '#4f46e5' : '#818cf8');
            ctx.moveTo(canvas.width / 2, canvas.height / 2);
            ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, angle, angle + arcSize);
            ctx.lineTo(canvas.width / 2, canvas.height / 2);
            ctx.fill();

            // Text
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(angle + arcSize / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(segment.label, canvas.width / 2 - 20, 10);
            ctx.restore();
        });
    }

    async function handleSpin() {
        if (isSpinning) return;

        const email = document.getElementById('lucky-wheel-email').value;
        if (!email) {
            alert('Please enter your email!');
            return;
        }

        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.innerText = 'SPINNING...';

        try {
            // 1. Get spin result from server (Security first!)
            const response = await fetch(`${proxyUrl}/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shop, wheelId: wheelConfig.id, email })
            });
            const result = await response.json();

            if (result.error) {
                alert(result.error);
                isSpinning = false;
                spinBtn.disabled = false;
                spinBtn.innerText = 'SPIN NOW';
                return;
            }

            // 2. Animate
            const segmentIndex = wheelConfig.segments.findIndex(s => s.id === result.segmentId);
            const arcSize = 360 / wheelConfig.segments.length;
            const rotation = 1440 + (360 - (segmentIndex * arcSize + arcSize / 2));

            canvas.style.transform = `rotate(${rotation}deg)`;

            setTimeout(() => {
                showResult(result);
            }, 5000);

        } catch (e) {
            console.error('Spin failed:', e);
            isSpinning = false;
        }
    }

    function showResult(result) {
        document.getElementById('lucky-wheel-form').style.display = 'none';
        const resultDiv = document.getElementById('lucky-wheel-result');
        resultDiv.style.display = 'block';
        document.getElementById('lucky-wheel-result-text').innerText = `You won: ${result.label}`;

        if (result.couponCode) {
            document.getElementById('lucky-wheel-coupon').innerText = result.couponCode;
        } else {
            document.querySelector('.coupon-box').style.display = 'none';
        }
    }

    closeBtn.onclick = () => { overlay.style.display = 'none'; };
    spinBtn.onclick = handleSpin;

    window.copyCoupon = () => {
        const coupon = document.getElementById('lucky-wheel-coupon').innerText;
        navigator.clipboard.writeText(coupon);
        alert('Coupon copied!');
    };

    initWheel();
})();
