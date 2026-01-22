export const LANDING_PAGE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Saldo - Finance App Server</title>
    <style>
        :root {
            --bg-color: #0a0a0a;
            --card-bg-dark: rgba(20, 20, 20, 0.95);
            --card-bg-light: rgba(35, 35, 35, 0.95);
            --text-primary: #f0f0f0;
            --text-secondary: #b0b0b0;
            --accent-gold: #d4af37;
            --gradient-gold: linear-gradient(135deg, #d4af37, #f2d06b, #d4af37);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(212, 175, 55, 0.08) 0%, transparent 25%),
                radial-gradient(circle at 90% 80%, rgba(212, 175, 55, 0.08) 0%, transparent 25%);
        }

        /* Floating Money Animation */
        .money-rain {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
        }
        .money-symbol {
            position: absolute;
            color: rgba(212, 175, 55, 0.25);
            font-size: 2rem;
            animation: floatUp 15s linear infinite;
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
        }
        @keyframes floatUp {
            0% { transform: translateY(110vh) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-20vh) rotate(360deg); opacity: 0; }
        }

        .stage {
            width: 100%;
            max-width: 1200px;
            padding: 2rem;
            z-index: 1;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
        }

        .card {
            padding: 2.5rem;
            border-radius: 24px;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(212, 175, 55, 0.1);
            backdrop-filter: blur(12px);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }

        .card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(212, 175, 55, 0.15);
            border-color: rgba(212, 175, 55, 0.3);
        }

        .card.light { background-color: var(--card-bg-light); }
        .card.dark { background-color: var(--card-bg-dark); }

        h2 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 1rem;
            line-height: 1.3;
        }

        p.lead {
            font-size: 1.05rem;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .gtext {
            background: var(--gradient-gold);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-weight: 800;
            display: inline-block;
        }

        /* Animated Icons */
        .icon-container {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5rem;
            font-size: 2.5rem;
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            border: 1px solid rgba(255, 255, 255, 0.08);
            animation: pulse-glow 3s infinite;
        }

        @keyframes pulse-glow {
            0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.2); border-color: rgba(212, 175, 55, 0.2); }
            50% { box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); border-color: rgba(212, 175, 55, 0.5); }
            100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); border-color: rgba(212, 175, 55, 0.2); }
        }
        
        /* Piggy Bank Animation */
        .piggy-wrapper {
            position: relative;
            display: inline-block;
        }
        .coin-drop {
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 1.5rem;
            opacity: 0;
            animation: dropCoin 2s infinite ease-in-out;
        }
        @keyframes dropCoin {
            0% { top: -25px; opacity: 0; transform: translateX(-50%) rotate(0deg); }
            20% { opacity: 1; }
            80% { top: 0px; opacity: 1; }
            100% { top: 5px; opacity: 0; transform: translateX(-50%) rotate(180deg); }
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.5rem 1.2rem;
            background: rgba(40, 167, 69, 0.15);
            border: 1px solid rgba(40, 167, 69, 0.4);
            border-radius: 50px;
            color: #4cd964;
            font-size: 0.9rem;
            font-weight: 600;
            margin-top: 1.5rem;
            transition: all 0.3s ease;
        }
        
        .status-badge:hover {
            background: rgba(40, 167, 69, 0.25);
            box-shadow: 0 0 15px rgba(76, 217, 100, 0.3);
        }

        .status-dot {
            width: 10px;
            height: 10px;
            background-color: #4cd964;
            border-radius: 50%;
            margin-right: 10px;
            box-shadow: 0 0 10px #4cd964;
            animation: blink 2s infinite;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
        }

        /* Savings Graph Bar */
        .graph-container {
            display: flex;
            align-items: flex-end;
            gap: 6px;
            height: 50px;
            margin-bottom: 25px;
            padding-bottom: 5px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .bar {
            flex: 1;
            background: var(--gradient-gold);
            border-radius: 4px 4px 0 0;
            animation: growBar 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            opacity: 0.9;
            transform-origin: bottom;
            transform: scaleY(0);
        }
        .bar:nth-child(1) { animation-delay: 0.1s; }
        .bar:nth-child(2) { animation-delay: 0.2s; }
        .bar:nth-child(3) { animation-delay: 0.3s; }
        .bar:nth-child(4) { animation-delay: 0.4s; }
        .bar:nth-child(5) { animation-delay: 0.5s; }
        
        @keyframes growBar {
            to { transform: scaleY(1); }
        }

    </style>
</head>
<body>
    <div class="money-rain" id="moneyRain"></div>

    <main class="stage">
      <section class="frame">
        <div class="grid">
            <!-- Welcome Card -->
          <article class="card light">
            <div class="icon-container">
                <div class="piggy-wrapper">
                    <span class="coin-drop">🪙</span>
                    🐷
                </div>
            </div>
            <h2>Welcome to <span class="gtext">Saldo</span></h2>
            <p class="lead">Smart financial tracking designed for your future. Save more, worry less.</p>
          </article>
          
          <!-- Status Card -->
          <article class="card dark">
            <div class="icon-container">🚀</div>
            <h2>Server <span class="gtext">Status</span></h2>
            <p class="lead">Backend services are fully operational.</p>
            <div class="status-badge">
                <span class="status-dot"></span>
                System Online
            </div>
          </article>
          
          <!-- Savings/Growth Card -->
          <article class="card dark">
             <div class="graph-container">
                <div class="bar" style="height: 30%"></div>
                <div class="bar" style="height: 45%"></div>
                <div class="bar" style="height: 40%"></div>
                <div class="bar" style="height: 70%"></div>
                <div class="bar" style="height: 60%"></div>
                <div class="bar" style="height: 90%"></div>
            </div>
            <h2>Track <span class="gtext heavy">Growth</span></h2>
             <p class="lead">Visualize your savings and spending habits in real-time.</p>
          </article>
          
          <!-- Developer Card -->
          <article class="card light">
            <div class="icon-container">👨‍💻</div>
            <h2>Developed by <span class="gtext heavy">Alif</span></h2>
            <p class="lead">Built with passion using Node.js, Express & TypeScript.</p>
          </article>
        </div>
      </section>
    </main>

    <script>
        // Generate floating money symbols
        const symbols = ['💰', '💲', '🪙', '💵', '📈', '✨'];
        const container = document.getElementById('moneyRain');
        
        // Create initial batch
        for(let i = 0; i < 20; i++) {
            createSymbol();
        }

        function createSymbol() {
            const el = document.createElement('div');
            el.classList.add('money-symbol');
            el.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            el.style.left = Math.random() * 100 + 'vw';
            el.style.animationDuration = (Math.random() * 10 + 15) + 's';
            el.style.animationDelay = (Math.random() * 5) + 's';
            el.style.fontSize = (Math.random() * 1.5 + 1) + 'rem';
            el.style.opacity = Math.random() * 0.4 + 0.1;
            container.appendChild(el);
        }
    </script>
</body>
</html>
`;
