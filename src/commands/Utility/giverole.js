import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
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
        const deferSuccess =
            await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {
            logger.warn('Failed to defer giverole interaction', {
                userId: interaction.user.id,
                guildId: interaction.guildId
            });

            return;
        }

        try {
            // Get the selected Discord user
            const targetUser =
                interaction.options.getUser('user');

            // Get the actual Discord role
            const role =
                interaction.options.getRole('role');

            if (!targetUser) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Invalid User',
                            description:
                                '❌ Please select a valid member.',
                            color: 'error'
                        })
                    ]
                });
            }

            if (!role) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Invalid Role',
                            description:
                                '❌ Please select a valid role.',
                            color: 'error'
                        })
                    ]
                });
            }

            // Fetch the member
            const member =
                await interaction.guild.members
                    .fetch(targetUser.id)
                    .catch(() => null);

            if (!member) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Member Not Found',
                            description:
                                '❌ I could not find that member in this server.',
                            color: 'error'
                        })
                    ]
                });
            }

            // Check bot permissions
            const botMember =
                interaction.guild.members.me;

            if (!botMember) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Error',
                            description:
                                '❌ I could not find my member information.',
                            color: 'error'
                        })
                    ]
                });
            }

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Missing Permission',
                            description:
                                '❌ I need the **Manage Roles** permission.',
                            color: 'error'
                        })
                    ]
                });
            }

            // Managed roles cannot be manually assigned
            if (role.managed) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Cannot Give Role',
                            description:
                                `❌ **${role.name}** is a managed role and cannot be manually assigned.`,
                            color: 'error'
                        })
                    ]
                });
            }

            // Discord role hierarchy check
            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Role Too High',
                            description:
                                `❌ I cannot give **${role.name}** because it is higher than or equal to my highest role.\n\n` +
                                `Move my highest bot role **above ${role.name}** in Server Settings → Roles.`,
                            color: 'error'
                        })
                    ]
                });
            }

            // Check if user already has role
            if (member.roles.cache.has(role.id)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Already Has Role',
                            description:
                                `⚠️ ${member} already has **${role.name}**.`,
                            color: 'warning'
                        })
                    ]
                });
            }

            // Give role
            await member.roles.add(
                role,
                `Role given by ${interaction.user.tag}`
            );

            logger.info(
                `${interaction.user.tag} gave ${role.name} to ${member.user.tag}`
            );

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'Role Given Successfully',
                        description:
                            `✅ Successfully gave **${role.name}** to ${member}.\n\n` +
                            `**Role:** ${role}\n` +
                            `**Member:** ${member}\n` +
                            `**Moderator:** ${interaction.user}`,
                        color: 'success'
                    })
                ]
            });

        } catch (error) {
            logger.error(
                'giverole command failed:',
                error
            );

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description:
                            '❌ Something went wrong while giving the role.',
                        color: 'error'
                    })
                ]
            });
        }
    }
};
