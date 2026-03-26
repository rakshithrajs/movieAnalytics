import { motion } from "framer-motion";

import type { MetricCardModel } from "../../../types/events";

interface MetricCardProps {
    model: MetricCardModel;
}

export function MetricCard({ model }: MetricCardProps) {
    return (
        <motion.article
            className={`metric-card ${model.emphasis === "highlight" ? "is-highlight" : ""}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
            <p className="metric-label">{model.label}</p>
            <p className="metric-value">{model.value}</p>
            {model.delta && <p className="metric-delta">{model.delta}</p>}
        </motion.article>
    );
}
