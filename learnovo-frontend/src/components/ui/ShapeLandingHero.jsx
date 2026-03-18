import { motion } from "framer-motion";
import { Circle } from "lucide-react";
import { cn } from "../../lib/utils";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-[#3EC4B1]/[0.15]",
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-[#3EC4B1]/[0.2]",
            "shadow-[0_8px_32px_0_rgba(62,196,177,0.15)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(62,196,177,0.2),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

function HeroGeometric({
  badge,
  title1 = "Elevate Your Digital Vision",
  title2 = "Crafting Exceptional Websites",
  description,
  children,
}) {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <div
      className="relative h-full w-full flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0b9e9e 0%, #0ea5a3 30%, #3EC4B1 65%, #2aafa8 100%)' }}
    >
      {/* Soft radial glows matching brand palette */}
      <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(62,196,177,0.5) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(180,230,220,0.3) 0%, transparent 70%)' }} />
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />

      <div className="absolute inset-0 overflow-hidden">
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="from-[#3EC4B1]/[0.18]"
          className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
        />

        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="from-[#a8e6cf]/[0.2]"
          className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
        />

        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="from-[#3EC4B1]/[0.22]"
          className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
        />

        <ElegantShape
          delay={0.6}
          width={200}
          height={60}
          rotate={20}
          gradient="from-white/[0.12]"
          className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
        />

        <ElegantShape
          delay={0.7}
          width={150}
          height={40}
          rotate={-25}
          gradient="from-[#b5ece4]/[0.18]"
          className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-lg mx-auto text-center">
          {badge && (
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.1] border border-white/[0.2] mb-8 md:mb-12"
            >
              <Circle className="h-2 w-2 fill-[#3EC4B1]" />
              <span className="text-sm text-white/80 tracking-wide font-medium">
                {badge}
              </span>
            </motion.div>
          )}

          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold mb-6 md:mb-8 tracking-tight leading-[1.1]">
              <span className="text-white">
                {title1}
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-[#d4f5ed] to-[#b5ece4]">
                {title2}
              </span>
            </h1>
          </motion.div>

          {description && (
            <motion.div
              custom={2}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              <p className="text-base sm:text-lg text-white/70 mb-8 leading-relaxed font-light tracking-wide max-w-md mx-auto px-4">
                {description}
              </p>
            </motion.div>
          )}

          {children && (
            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>

      {/* Subtle edge vignette matching brand gradient */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(10,120,120,0.25) 0%, transparent 30%, transparent 70%, rgba(10,143,143,0.15) 100%)' }} />
    </div>
  );
}

export { HeroGeometric, ElegantShape };
