// CLI scripts run outside Next.js, where cache revalidation is not available.
module.exports = { revalidateTag() {}, revalidatePath() {}, unstable_cache: (fn) => fn };
