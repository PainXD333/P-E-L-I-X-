import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('Give a role to a member')

        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Member to give the role to')
                .setRequired(true)
        )

        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Role to give')
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        ),

    category: 'utility',

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            if (!targetUser || !role) {
                return interaction.reply({
                    content: '❌ Please select a user and a role.',
                    ephemeral: true
                });
            }

            return await giveRole({
                guild: interaction.guild,
                executor: interaction.member,
                targetUser,
                role,
                reason: `Role given by ${interaction.user.tag}`,
                reply: async (data) => {
                    return interaction.reply(data);
                }
            });

        } catch (error) {
            logger.error('giverole slash command error:', error);

            if (interaction.replied || interaction.deferred) {
                return interaction.editReply({
                    content: `❌ Error: ${error.message}`
                }).catch(() => {});
            }

            return interaction.reply({
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            }).catch(() => {});
        }
    },

    /**
     * Used by the $ prefix system.
     *
     * Usage:
     * $giverole @user Staff
     * $giverole @user Senior Staff
     */
    async executePrefix(message, args) {
        try {
            if (!message.guild) {
                return;
            }

            // -----------------------------------------
            // USER
            // -----------------------------------------

            const targetUser = message.mentions.users.first();

            if (!targetUser) {
                return message.channel.send({
                    embeds: [
                        createEmbed({
                            title: '❌ Missing User',
                            description:
                                `Usage:\n\`$giverole @user Staff\`\n\n` +
                                `Mention the member you want to give the role to.`,
                            color: 'error'
                        })
                    ]
                });
            }

            // -----------------------------------------
            // ROLE NAME
            // -----------------------------------------

            // Remove the user mention from the arguments.
            const roleName = args
                .filter(arg => !/^<@!?\d+>$/.test(arg))
                .join(' ')
                .trim();

            if (!roleName) {
                return message.channel.send({
                    embeds: [
                        createEmbed({
                            title: '❌ Missing Role',
                            description:
                                `Usage:\n\`$giverole @user Staff\`\n\n` +
                                `You need to specify a role name.`,
                            color: 'error'
                        })
                    ]
                });
            }

            // -----------------------------------------
            // FIND ROLE
            // -----------------------------------------

            const role = message.guild.roles.cache.find(
                r =>
                    r.name.toLowerCase() ===
                    roleName.toLowerCase()
            );

            if (!role) {
                return message.channel.send({
                    embeds: [
                        createEmbed({
                            title: '❌ Role Not Found',
                            description:
                                `I couldn't find a role named **${roleName}**.`,
                            color: 'error'
                        })
                    ]
                });
            }

            // -----------------------------------------
            // EXECUTE
            // -----------------------------------------

            return await giveRole({
                guild: message.guild,
                executor: message.member,
                targetUser,
                role,
                reason: `Role given by ${message.author.tag}`,
                reply: async (data) => {
                    return message.channel.send(data);
                }
            });

        } catch (error) {
            logger.error('giverole prefix command error:', error);

            return message.channel.send({
                embeds: [
                    createEmbed({
                        title: '❌ Error',
                        description:
                            `Something went wrong:\n\`\`\`\n${error.message}\n\`\`\``,
                        color: 'error'
                    })
                ]
            }).catch(() => {});
        }
    }
};


/*
|--------------------------------------------------------------------------
| GIVE ROLE FUNCTION
|--------------------------------------------------------------------------
*/

async function giveRole({
    guild,
    executor,
    targetUser,
    role,
    reason,
    reply
}) {

    if (!guild) {
        return reply({
            content: '❌ This command can only be used in a server.'
        });
    }

    // -----------------------------------------
    // EXECUTOR PERMISSION
    // -----------------------------------------

    if (
        !executor.permissions.has(
            PermissionFlagsBits.ManageRoles
        ) &&
        !executor.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Missing Permission',
                    description:
                        'You need the **Manage Roles** permission to use this command.',
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // BOT MEMBER
    // -----------------------------------------

    const botMember = guild.members.me;

    if (!botMember) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Bot Error',
                    description:
                        'I could not find my member information in this server.',
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // BOT PERMISSION
    // -----------------------------------------

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Missing Bot Permission',
                    description:
                        'I need the **Manage Roles** permission.',
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // TARGET MEMBER
    // -----------------------------------------

    const targetMember = await guild.members
        .fetch(targetUser.id)
        .catch(() => null);

    if (!targetMember) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Member Not Found',
                    description:
                        'I could not find that member in this server.',
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // MANAGED ROLE
    // -----------------------------------------

    if (role.managed) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Managed Role',
                    description:
                        `**${role.name}** is a managed role and cannot be manually assigned.`,
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // BOT ROLE HIERARCHY
    // -----------------------------------------

    if (
        role.position >=
        botMember.roles.highest.position
    ) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Role Too High',
                    description:
                        `I cannot give **${role.name}**.\n\n` +
                        `My highest role is **${botMember.roles.highest.name}**.\n\n` +
                        `Move my **${botMember.roles.highest.name}** role **above ${role.name}** in Server Settings → Roles.`,
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // EXECUTOR ROLE HIERARCHY
    // -----------------------------------------

    if (
        !executor.permissions.has(
            PermissionFlagsBits.Administrator
        ) &&
        role.position >= executor.roles.highest.position
    ) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Role Too High',
                    description:
                        `You cannot give **${role.name}** because it is higher than or equal to your highest role.`,
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // SERVER OWNER
    // -----------------------------------------

    if (targetMember.id === guild.ownerId) {
        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Cannot Modify Owner',
                    description:
                        'The server owner cannot have roles managed by the bot.',
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // ALREADY HAS ROLE
    // -----------------------------------------

    if (targetMember.roles.cache.has(role.id)) {
        return reply({
            embeds: [
                createEmbed({
                    title: '⚠️ Already Has Role',
                    description:
                        `${targetMember} already has **${role.name}**.`,
                    color: 'warning'
                })
            ]
        });
    }

    // -----------------------------------------
    // ADD ROLE
    // -----------------------------------------

    try {

        await targetMember.roles.add(
            role.id,
            reason
        );

    } catch (error) {

        logger.error('Discord add role error:', {
            code: error.code,
            message: error.message,
            guildId: guild.id,
            userId: targetUser.id,
            roleId: role.id
        });

        let description =
            'Discord rejected the role assignment.';

        if (error.code === 50013) {
            description =
                'I do not have permission to give this role.\n\n' +
                `Move my **${botMember.roles.highest.name}** role above **${role.name}**.`;
        }

        return reply({
            embeds: [
                createEmbed({
                    title: '❌ Failed to Give Role',
                    description,
                    color: 'error'
                })
            ]
        });
    }

    // -----------------------------------------
    // SUCCESS
    // -----------------------------------------

    logger.info(
        `Role given | ${targetUser.tag} | ${role.name} | ${guild.name}`
    );

    return reply({
        embeds: [
            createEmbed({
                title: '✅ Role Given',
                description:
                    `Successfully gave **${role.name}** to ${targetMember}.`,
                color: 'success'
            })
        ]
    });
}
