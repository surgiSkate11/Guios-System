import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from './password';

const VIGENCIA_MS = 30 * 60 * 1000;
const ENLACE_INVALIDO = 'El enlace no es válido o venció';

/** The token has 256 random bits, so a fast hash is enough to store it safely. */
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Password recovery with a temporary emailed link (RF-25). */
@Injectable()
export class RecuperacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Always succeeds silently so the response never reveals whether the email exists. */
  async solicitar(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.tokenRecuperacion.create({
      data: {
        idUsuario: usuario.id,
        tokenHash: hashToken(token),
        venceEn: new Date(Date.now() + VIGENCIA_MS),
      },
    });
    const web = this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
    await this.mail.enviar({
      para: usuario.email,
      asunto: 'Recupera tu contraseña de GUIOS PRO',
      texto:
        `Hola ${usuario.nombre}:\n\nPara elegir una contraseña nueva abre este enlace ` +
        `(vence en 30 minutos y sirve una sola vez):\n${web}/restablecer?token=${token}\n\n` +
        'Si no lo pediste, ignora este correo.',
    });
  }

  async restablecer(token: string, password: string): Promise<void> {
    const fila = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: true },
    });
    if (
      !fila ||
      fila.usado ||
      fila.venceEn < new Date() ||
      !fila.usuario.activo
    ) {
      throw new BadRequestException(ENLACE_INVALIDO);
    }
    // Marking the token used inside the same transaction makes it single-use under races.
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.tokenRecuperacion.updateMany({
        where: { id: fila.id, usado: false },
        data: { usado: true },
      });
      if (count === 0) throw new BadRequestException(ENLACE_INVALIDO);
      await tx.usuario.update({
        where: { id: fila.idUsuario },
        data: { passwordHash: await hashPassword(password) },
      });
    });
  }
}
