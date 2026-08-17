import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const KEY_PREFIX = 'temp:autoresponders:';

function getKey(guildId) {
    return `${KEY_PREFIX}${guildId}`;
}

function normalizeTrigger(trigger) {
    return String(trigger ?? '')
        .trim()
        .toLowerCase();
}

function normalizeResponse(response) {
    return String(response ?? '').trim();
}

function normalizeList(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id ?? null,
            guildId: item.guildId ?? null,
            trigger: normalizeTrigger(item.trigger),
            response: normalizeResponse(item.response),
            createdBy: item.createdBy ?? null,
            createdAt: item.createdAt ?? Date.now(),
            updatedAt: item.updatedAt ?? Date.now(),
        }))
        .filter(item => item.trigger && item.response);
}

export const AutoresponderService = {
    /**
     * Get all autoresponders for a guild.
     */
    async getAll(guildId) {
        try {
            if (!guildId) {
                return [];
            }

            const data = await db.get(
                getKey(guildId),
                []
            );

            return normalizeList(data).sort(
                (a, b) =>
                    a.trigger.localeCompare(b.trigger)
            );
        } catch (error) {
            logger.error(
                `Failed to get autoresponders for guild ${guildId}:`,
                error
            );

            return [];
        }
    },

    /**
     * Add or update an autoresponder.
     */
    async add({
        guildId,
        trigger,
        response,
        createdBy = null,
    }) {
        if (!guildId) {
            throw new Error('Guild ID is required.');
        }

        const normalizedTrigger =
            normalizeTrigger(trigger);

        const normalizedResponse =
            normalizeResponse(response);

        if (!normalizedTrigger) {
            throw new Error(
                'Autoresponder trigger cannot be empty.'
            );
        }

        if (!normalizedResponse) {
            throw new Error(
                'Autoresponder response cannot be empty.'
            );
        }

        if (normalizedTrigger.length > 100) {
            throw new Error(
                'Autoresponder trigger cannot exceed 100 characters.'
            );
        }

        if (normalizedResponse.length > 2000) {
            throw new Error(
                'Autoresponder response cannot exceed 2000 characters.'
            );
        }

        const responders =
            await this.getAll(guildId);

        const existingIndex =
            responders.findIndex(
                item =>
                    item.trigger ===
                    normalizedTrigger
            );

        const now = Date.now();

        if (existingIndex !== -1) {
            const existing =
                responders[existingIndex];

            const updated = {
                ...existing,
                guildId,
                trigger: normalizedTrigger,
                response: normalizedResponse,
                createdBy:
                    existing.createdBy ??
                    createdBy ??
                    null,
                updatedAt: now,
            };

            responders[existingIndex] = updated;

            await db.set(
                getKey(guildId),
                responders
            );

            logger.info(
                `Autoresponder updated: "${normalizedTrigger}"`,
                {
                    guildId,
                    createdBy,
                    autoresponderId: updated.id,
                }
            );

            return updated;
        }

        const autoresponder = {
            id: `${guildId}-${now}-${Math.random()
                .toString(36)
                .slice(2, 10)}`,

            guildId,

            trigger: normalizedTrigger,

            response: normalizedResponse,

            createdBy: createdBy ?? null,

            createdAt: now,

            updatedAt: now,
        };

        responders.push(autoresponder);

        await db.set(
            getKey(guildId),
            responders
        );

        logger.info(
            `Autoresponder created: "${normalizedTrigger}"`,
            {
                guildId,
                createdBy,
                autoresponderId:
                    autoresponder.id,
            }
        );

        return autoresponder;
    },

    /**
     * Remove an autoresponder.
     */
    async remove(guildId, trigger) {
        if (!guildId) {
            return false;
        }

        const normalizedTrigger =
            normalizeTrigger(trigger);

        if (!normalizedTrigger) {
            return false;
        }

        const responders =
            await this.getAll(guildId);

        const originalLength =
            responders.length;

        const filtered =
            responders.filter(
                item =>
                    item.trigger !==
                    normalizedTrigger
            );

        if (
            filtered.length ===
            originalLength
        ) {
            return false;
        }

        await db.set(
            getKey(guildId),
            filtered
        );

        logger.info(
            `Autoresponder removed: "${normalizedTrigger}"`,
            {
                guildId,
            }
        );

        return true;
    },

    /**
     * Find autoresponders matching a Discord message.
     *
     * Matching is case-insensitive and supports
     * triggers appearing anywhere in the message.
     *
     * Longest trigger wins.
     */
    async findMatches(guildId, messageContent) {
        try {
            if (!guildId) {
                return [];
            }

            if (
                typeof messageContent !==
                    'string' ||
                !messageContent.trim()
            ) {
                return [];
            }

            const content =
                messageContent
                    .trim()
                    .toLowerCase();

            const responders =
                await this.getAll(guildId);

            const matches =
                responders.filter(item => {
                    if (!item.trigger) {
                        return false;
                    }

                    return content.includes(
                        item.trigger
                    );
                });

            matches.sort((a, b) => {
                if (
                    b.trigger.length !==
                    a.trigger.length
                ) {
                    return (
                        b.trigger.length -
                        a.trigger.length
                    );
                }

                return (
                    (b.updatedAt ?? 0) -
                    (a.updatedAt ?? 0)
                );
            });

            return matches;
        } catch (error) {
            logger.error(
                `Failed to find autoresponder matches for guild ${guildId}:`,
                error
            );

            return [];
        }
    },
};

export default AutoresponderService;
