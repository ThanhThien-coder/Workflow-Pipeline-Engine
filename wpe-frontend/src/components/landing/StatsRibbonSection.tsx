import type { FC } from 'react'
import { motion } from 'framer-motion'
import { CountUp } from './CountUp'
import { editorialStaggerContainer, cardParallaxEnter } from '../../lib/motion'

export const StatsRibbonSection: FC = () => {
  const stats = [
    {
      value: 12,
      suffix: '',
      title: 'PostgreSQL 3NF & JSONB Tables',
      desc: 'Strict 3NF normalization combined with flexible JSONB data',
    },
    {
      value: 5,
      suffix: '',
      title: 'FSM Lifecycle States',
      desc: 'LOCKED → TODO → IN_PROGRESS → REVIEW → DONE',
    },
    {
      value: 100,
      suffix: '%',
      title: 'Deadlock Cycle Elimination',
      desc: "O(V+E) Kahn's algorithm validates DAG before publication",
    },
    {
      value: 23,
      suffix: '',
      title: 'RBAC Security Use Cases',
      desc: 'Tiered role access: Super Admin, Project Owner, Member, and Guest',
    },
  ]

  return (
    <section className="relative border-y border-mp-n-200 bg-[#FBF9F9] py-16 lg:py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={editorialStaggerContainer}
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12"
        >
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              variants={cardParallaxEnter}
              className="flex flex-col items-center sm:items-start text-center sm:text-left transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="text-5xl sm:text-6xl font-medium tracking-[-0.04em] tabular-nums text-mp-ink">
                <CountUp to={stat.value} suffix={stat.suffix} duration={1.5 + idx * 0.2} />
              </div>
              <h3 className="mt-3 text-base sm:text-lg font-bold text-mp-ink">
                {stat.title}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-mp-n-600 leading-relaxed max-w-xs">
                {stat.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

