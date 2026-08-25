const RULES = [
    { name: 'explicit-max', points: 100, pattern: /(?:使用|切换|开启|启用).{0,10}(?:max|最大思考)|(?:max(?:imum)?|highest)\s+reasoning/iu },
    { name: 'deep-analysis', points: 3, pattern: /深度(?:分析|研究)|全面(?:分析|研究)|系统性(?:分析|研究)|完整(?:分析|研究)|in[- ]?depth|comprehensive|thorough\s+(?:analysis|research)/iu },
    { name: 'valuation-model', points: 3, pattern: /\bDCF\b|估值|财务建模|三表模型|valuation|financial\s+model(?:ling|ing)?/iu },
    { name: 'financial-filing', points: 2, pattern: /财报|年报|季报|现金流|资产负债表|利润表|earnings|financial\s+statements?|annual\s+report|10-[KQ]/iu },
    { name: 'research-deliverable', points: 3, pattern: /研究报告|投资报告|尽职调查|尽调|审计|架构设计|迁移方案|research\s+report|investment\s+memo|due\s+diligence|audit|architecture\s+design|migration\s+plan/iu },
    { name: 'cross-validation', points: 3, pattern: /交叉验证|多(?:来源|数据源|维度|方法).{0,8}(?:验证|分析)|cross[- ]?(?:check|validation)|multiple\s+(?:sources|methods)/iu },
    { name: 'scenario-risk', points: 3, pattern: /压力测试|情景分析|敏感性分析|反事实|风险评估|stress\s+test|scenario\s+analysis|sensitivity\s+analysis|counterfactual|risk\s+assessment/iu },
    { name: 'multi-entity-comparison', points: 2, pattern: /(?:对比|比较).{0,20}(?:公司|股票|模型|方案|架构)|多家公司|同业比较|compare.{0,30}(?:companies|stocks|models|approaches|architectures)/iu },
    { name: 'implementation-chain', points: 4, pattern: /(?:实现|开发).{0,40}(?:测试|验证|上线|发布|部署)|(?:安装|部署).{0,30}(?:配置|测试|验证)|implement.{0,50}(?:test|verify|deploy|publish)|deploy.{0,40}(?:configure|test|verify)/isu },
    { name: 'multi-stage-reasoning', points: 2, pattern: /分步骤|逐步推导|多阶段|多代理|多个\s*skills?|step[- ]by[- ]step|multi[- ]stage|multi[- ]agent|multiple\s+skills/iu },
];
function trustedText(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map(block => block.text.replace(/<auto_vision_observation\b[^>]*>[\s\S]*?<\/auto_vision_observation>/giu, ''))
        .join('\n');
}
function currentTurn(messages) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role !== 'user' || message.source.kind !== 'user')
            continue;
        let toolResults = 0;
        for (let tail = index + 1; tail < messages.length; tail += 1) {
            if (messages[tail]?.source.kind === 'tool')
                toolResults += 1;
        }
        const imageCount = message.content.filter(block => block.type === 'image').length;
        return { message, index, toolResults, imageCount };
    }
    return { index: -1, toolResults: 0, imageCount: 0 };
}
function enumeratedRequirementCount(text) {
    const numbered = text.match(/(?:^|\n)\s*(?:\d+[.)、]|[-*+]\s+)/gu)?.length ?? 0;
    const semicolonClauses = text.split(/[；;]/u).filter(part => part.trim().length > 12).length;
    return Math.max(numbered, semicolonClauses);
}
export function classifyComplexity(options, config) {
    const turn = currentTurn(options.messages);
    const turnKey = [
        String(options.sessionId ?? 'no-session'),
        String(turn.message?.id ?? 'no-user-message'),
        options.provider,
        options.model,
    ].join('|');
    if (options.purpose !== undefined) {
        return { tier: 'normal', score: 0, reasons: [`purpose:${options.purpose}`], turnKey };
    }
    if (turn.message === undefined)
        return { tier: 'normal', score: 0, reasons: ['no-user-message'], turnKey };
    const text = trustedText(turn.message);
    let score = 0;
    const reasons = [];
    for (const rule of RULES) {
        if (!rule.pattern.test(text))
            continue;
        score += rule.points;
        reasons.push(rule.name);
    }
    let customMatches = 0;
    const folded = text.toLocaleLowerCase();
    for (const keyword of config.additionalComplexKeywords) {
        if (folded.includes(keyword.toLocaleLowerCase()))
            customMatches += 1;
    }
    if (customMatches > 0) {
        score += customMatches * 3;
        reasons.push(`custom-keywords:${customMatches}`);
    }
    if (text.length >= 800) {
        score += 1;
        reasons.push('long-request');
    }
    if (text.length >= 1800) {
        score += 2;
        reasons.push('very-long-request');
    }
    const requirements = enumeratedRequirementCount(text);
    if (requirements >= 4) {
        score += 2;
        reasons.push('many-requirements');
    }
    if (requirements >= 8) {
        score += 2;
        reasons.push('extensive-requirements');
    }
    if (turn.toolResults >= 3) {
        score += 1;
        reasons.push('tool-chain');
    }
    if (turn.toolResults >= 6) {
        score += 2;
        reasons.push('long-tool-chain');
    }
    if (turn.imageCount >= 3) {
        score += 1;
        reasons.push('multiple-images');
    }
    return {
        tier: score >= config.threshold ? 'complex' : 'normal',
        score,
        reasons: reasons.length === 0 ? ['ordinary-request'] : reasons,
        turnKey,
    };
}
export class EscalationCache {
    maxEntries;
    decisions = new Map();
    constructor(maxEntries) {
        this.maxEntries = maxEntries;
    }
    retainHighest(candidate) {
        const previous = this.decisions.get(candidate.turnKey);
        const retained = previous !== undefined && previous.score > candidate.score ? previous : candidate;
        this.decisions.delete(candidate.turnKey);
        this.decisions.set(candidate.turnKey, retained);
        while (this.decisions.size > this.maxEntries) {
            const oldest = this.decisions.keys().next().value;
            if (oldest === undefined)
                break;
            this.decisions.delete(oldest);
        }
        return retained;
    }
}
//# sourceMappingURL=complexity.js.map