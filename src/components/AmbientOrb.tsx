import { motion } from 'motion/react';

export const AmbientOrb = () => {
    return (
        <motion.div
            className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full blur-[150px] pointer-events-none opacity-[0.15] z-0"
            style={{
                background: 'radial-gradient(circle, rgba(212, 255, 58, 0.6) 0%, transparent 70%)',
            }}
            animate={{
                x: [0, -100, 0],
                y: [0, 100, 0],
                scale: [1, 1.2, 1],
            }}
            transition={{
                duration: 25,
                repeat: Infinity,
                ease: "easeInOut",
            }}
        />
    );
};
