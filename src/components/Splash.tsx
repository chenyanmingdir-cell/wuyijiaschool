export default function Splash() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ececf0',
      padding: '40px 24px',
    }}>
      {/* Pixel-art dancing girl */}
      <div style={{
        width: 48,
        height: 70,
        marginBottom: 32,
        animation: 'dancerBounce 0.7s ease-in-out infinite',
        imageRendering: 'pixelated',
      }}>
        <img
          src="/wuyijiaschool/dancegirl.png"
          alt="dancing girl"
          width={48}
          height={70}
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        fontWeight: 600,
        color: 'var(--text)',
        margin: 0,
        letterSpacing: '0.08em',
        textAlign: 'center',
        animation: 'splashFadeUp 0.8s ease-out both',
      }}>
        杭州舞艺嘉
      </h1>

      {/* Divider */}
      <div style={{
        width: 40,
        height: 3,
        borderRadius: 2,
        background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
        margin: '24px 0',
        animation: 'splashDivider 1s 0.3s ease-out both',
      }} />

      {/* Slogan */}
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        color: 'var(--muted)',
        margin: 0,
        letterSpacing: '0.06em',
        textAlign: 'center',
        lineHeight: 1.8,
        animation: 'splashFadeUp 0.8s 0.5s ease-out both',
      }}>
        以舞之名，让花成花
      </p>

      {/* Loading dots */}
      <div style={{
        marginTop: 48,
        display: 'flex',
        gap: 8,
        animation: 'splashFadeUp 0.6s 1s ease-out both',
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--primary)',
              opacity: 0.4,
              animation: `splashDot 1.4s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashDivider {
          from { opacity: 0; transform: scaleX(0); }
          to { opacity: 1; transform: scaleX(1); }
        }
        @keyframes splashDot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
        @keyframes dancerBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
