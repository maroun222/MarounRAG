using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

using RagMiddleware.Application.Abstractions.Security;
using RagMiddleware.Application.Contracts.Auth;
using RagMiddleware.Domain.Entities;
using RagMiddleware.Infrastructure.Configuration;

namespace RagMiddleware.Api.Security;

public sealed class JwtTokenService
    : IJwtTokenService
{
    private readonly JwtOptions _options;

    private readonly SigningCredentials
        _signingCredentials;

    public JwtTokenService(
        IOptions<JwtOptions> options
    )
    {
        _options = options.Value;

        byte[] keyBytes =
            Convert.FromBase64String(
                _options.SigningKey
            );

        var securityKey =
            new SymmetricSecurityKey(
                keyBytes
            );

        _signingCredentials =
            new SigningCredentials(
                securityKey,
                SecurityAlgorithms
                    .HmacSha256
            );
    }

    public JwtTokenResult CreateToken(
        ApplicationUser user
    )
    {
        DateTime issuedAtUtc =
            DateTime.UtcNow;

        DateTime expiresAtUtc =
            issuedAtUtc.AddMinutes(
                _options.LifetimeMinutes
            );

        Claim[] claims =
        [
            new Claim(
                JwtRegisteredClaimNames.Sub,
                user.Id
            ),
            new Claim(
                JwtRegisteredClaimNames.Email,
                user.Email
            ),
            new Claim(
                "name",
                user.Name
            ),
            new Claim(
                "google_sub",
                user.GoogleSubject
            ),
            new Claim(
                JwtRegisteredClaimNames.Jti,
                Guid.NewGuid().ToString("N")
            )
        ];

        var token =
            new JwtSecurityToken(
                issuer: _options.Issuer,
                audience: _options.Audience,
                claims: claims,
                notBefore: issuedAtUtc,
                expires: expiresAtUtc,
                signingCredentials:
                    _signingCredentials
            );

        string encodedToken =
            new JwtSecurityTokenHandler()
                .WriteToken(token);

        return new JwtTokenResult
        {
            Token = encodedToken,
            ExpiresAtUtc = expiresAtUtc
        };
    }
}