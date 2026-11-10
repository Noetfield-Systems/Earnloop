/**
 * Earnloop copy-first source map. Canonical human execution order:
 * docs/EXECUTION-ORDER-v1.md (not a competing Company OS registry).
 * The copy source is a business mechanic, licensed component, or approved API;
 * no proprietary third-party application code is represented as reusable.
 */
export const REPLICATION_TARGETS=Object.freeze([
 {id:'torox',priority:'P0',owner:'partnerships',method:'approved_partner_api',source:'https://torox.io/publisher-integration-guide/',target:'src/torox.mjs',state:'adapter_implemented_approval_not_verified',success:'one provider-approved Canadian offer and independently reconciled paid conversion'},
 {id:'benchmark',priority:'P0',owner:'revenue',method:'replicate_mechanics_only',source:'https://freecash.com',alternates:['https://rewardxp.com','https://lootup.me','https://scrambly.io'],target:'public/index.html',state:'product_loop_started',success:'actual advertiser-paid activation and repeat customer engagement; no copied proprietary code'},
 {id:'zealy',priority:'P1',owner:'community',method:'replicate_mechanics_only',source:'https://zealy.io',target:'src/server.mjs',state:'daily_xp_leaderboard_referral_live',success:'real activated members and qualified organic referrals'},
 {id:'bitlabs',priority:'P1',owner:'partnerships',method:'approved_partner_api',source:'https://developer.bitlabs.ai/docs/getting-started',target:'future/provider-bitlabs',state:'backup_after_torox_decision',success:'signed callbacks, Canadian offer inventory and real advertiser conversion'},
 {id:'tremendous',priority:'P2',owner:'revenue',method:'funded_provider_api',source:'https://www.tremendous.com/gift-card-api',target:'future/rewards-catalog',state:'blocked_until_funded_rewards',success:'authorized financed digital gift cards actually delivered'},
 {id:'saas_starter',priority:'P2',owner:'engineering',method:'selective_mit_component_port',source:'https://github.com/nextjs/saas-starter',commit:'6e33e58b1e553a41fe22e6b941a7229a002de361',target:'future/identity-ui-only',state:'deferred_existing_product_runs',success:'measurable auth need; preserve MIT license notices'},
 {id:'seo_template',priority:'P2',owner:'growth',method:'selective_mit_component_port',source:'https://github.com/ixartz/Next-js-Boilerplate',commit:'b83157a8018f55b926a3c25a4b7a7e14b0dfbc35',target:'future/seo-patterns',state:'deferred_not_a_second_app',success:'more genuine search traffic to product landing'},
 {id:'medusa',priority:'P3',owner:'revenue',method:'selective_licensed_code_only',source:'https://github.com/medusajs/medusa',target:'future/merchant-commerce',state:'deferred_until_margin_proven',success:'real vendor-backed repeat purchase without unfunded wallet liabilities'}
]);

/** Only system actions backed by actual state are recommended. */
export function nextCommercialAction(facts={},env={}) {
 const approved=env.TOROX_PUBLISHER_APPROVED==='true' && Boolean(env.TOROX_APPROVAL_REFERENCE);
 const credentials=Boolean(env.TOROX_PLACEMENT_ID && env.TOROX_APP_TOKEN && ['staging','production'].includes(env.TOROX_MODE));
 const result=(priority,owner,source,action,evidence)=>({priority,owner,source,action,evidence,money_moved:false,external_action_executed:false});
 if(!approved) return result(0,'partnerships','torox','obtain_publisher_acceptance','Written Torox contract, approval reference and eligible Canadian web offer inventory');
 if(!credentials) return result(0,'engineering','torox','configure_publisher_placement_privately','Verified private Railway variable names and registered partner source');
 if(env.TOROX_POSTBACK_VERIFIED!=='true') return result(0,'trust','torox','verify_real_partner_callbacks_and_reversals','Provider test postback, idempotency, chargeback handling, fraud and financial reconciliations; legacy MD5 cannot authorize money');
 if(Number(facts.settled_events||0)===0) return result(0,'revenue','torox','obtain_first_confirmed_funded_conversion','Partner dashboard + independent cleared bank statement + costed real user reward');
 if(Number(facts.members||0)<20) return result(1,'growth','zealy','acquire_20_real_members','Consented real users, tracked organic channels and initial activation cohort');
 const activation=Number(facts.activated||0)/Math.max(1,Number(facts.members||0));
 if(activation<.3) return result(1,'growth','zealy','raise_quest_activation','30% first-session activation on non-synthetic members');
 return result(2,'revenue','torox','improve_verified_contribution_and_repeat_use','Actual collected margin net of provider fees, reversals, funded rewards and user support');
}
