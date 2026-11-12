export const Overlay = () => {
    return (
        <div 
            className="fixed inset-0 z-70 pointer-events-none opacity-[0.055] mix-blend-screen"
            style={{ 
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`
            }}
        />
    );
};
